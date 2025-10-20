const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const {
  isManager,
  addManager,
  removeManager,
  listManagers,
} = require("./utils/role");

const {
  assignClient,
  getManagerByClient,
  getClientByManager,
  removeSession,
} = require("./logic/handlers");

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

const inviteMessages = {};
const userData = {};

function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+?380\d{9}|0\d{9})$/.test(cleaned);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email);
}

bot.start((ctx) => {
  const id = ctx.from.id;

  if (isManager(id)) {
    ctx.reply("👔 Ви увійшли як менеджер.");
  } else {
    ctx.reply(
      "Привіт! 👋 Оберіть, що вас цікавить:",
      Markup.keyboard([
        ["Маю проблему з купленими уроками"],
        ["Хочу купити WoW-уроки"],
      ]).resize()
    );
  }
});

bot.hears(
  ["Маю проблему з купленими уроками", "Хочу купити WoW-уроки"],
  async (ctx) => {
    const clientId = ctx.from.id;

    if (getManagerByClient(clientId)) {
      return ctx.reply("🕐 Ваш запит вже обробляється. Очікуйте, будь ласка.");
    }

    userData[clientId] = {
      step: "name",
      type: ctx.message.text,
      username: ctx.from.username || ctx.from.first_name || "Без_імені",
    };

    await ctx.reply("✍️ Введіть, будь ласка, ваше ім’я:");
  }
);

bot.on("text", async (ctx) => {
  const clientId = ctx.from.id;
  const msg = ctx.message.text.trim();
  const current = userData[clientId];

  if (current && current.step) {
    try {
      if (current.step === "name") {
        if (msg.length < 2 || msg.length > 50) {
          return ctx.reply(
            "⚠️ Ім’я занадто коротке або довге. Введіть ще раз:"
          );
        }
        current.name = msg;
        current.step = "phone";
        return ctx.reply(
          "📞 Введіть ваш номер телефону (наприклад +380931234567):"
        );
      }

      if (current.step === "phone") {
        if (!isValidPhone(msg)) {
          return ctx.reply(
            "❌ Невірний формат номера.\nПриклад: +380931234567 або 0931234567.\nСпробуйте ще раз:"
          );
        }
        current.phone = msg.replace(/\s+/g, "");
        current.step = "email";
        return ctx.reply("📧 Введіть вашу електронну пошту:");
      }

      if (current.step === "email") {
        if (!isValidEmail(msg)) {
          return ctx.reply(
            "❌ Невірний формат email.\nПриклад: example@gmail.com\nВведіть ще раз:"
          );
        }

        current.email = msg.toLowerCase();
        current.step = "done";

        await ctx.reply("✅ Дякуємо! Зараз підключимо менеджера...");

        const { name, phone, email, type, username } = current;
        inviteMessages[clientId] = [];

        for (const manager of listManagers()) {
          try {
            const sent = await bot.telegram.sendMessage(
              manager.id,
              `📥 Новий запит від @${username}\n\n🧑 Ім’я: ${name}\n📞 Телефон: ${phone}\n📧 Email: ${email}\n💬 Тип запиту: ${type}`,
              Markup.inlineKeyboard([
                Markup.button.callback(
                  `🔗 Взяти клієнта ${clientId}`,
                  `take_${clientId}`
                ),
                Markup.button.callback("❌ Відхилити", `decline_${clientId}`),
              ])
            );

            inviteMessages[clientId].push({
              managerId: manager.id,
              messageId: sent.message_id,
            });
          } catch (err) {
            console.error(`Помилка відправки менеджеру ${manager.id}:`, err);
          }
        }

        return;
      }
    } catch (err) {
      console.error("❌ Помилка в обробці даних користувача:", err);
      ctx.reply("⚠️ Сталася помилка. Спробуйте ще раз пізніше.");
    }
  }

  try {
    const userId = ctx.from.id;

    if (isManager(userId)) {
      const clientId = getClientByManager(userId);
      if (clientId) {
        return bot.telegram.copyMessage(
          clientId,
          userId,
          ctx.message.message_id
        );
      }
    } else {
      const managerId = getManagerByClient(userId);
      if (managerId) {
        return bot.telegram.copyMessage(
          managerId,
          userId,
          ctx.message.message_id
        );
      } else {
        ctx.reply("🟡 Ваш запит ще не обробляється. Оберіть опцію з меню.");
      }
    }
  } catch (err) {
    console.error("💥 Помилка при передачі повідомлення:", err);
  }
});

bot.action(/^take_(\d+)$/, async (ctx) => {
  const managerId = ctx.from.id;
  const clientId = ctx.match[1];

  if (!isManager(managerId)) return ctx.reply("⛔ Ви не маєте прав.");

  if (parseInt(clientId) === managerId)
    return ctx.reply("⛔ Ви не можете обслуговувати самі себе.");

  const current = getManagerByClient(clientId);
  if (current) {
    if (current == managerId)
      return ctx.reply("✅ Ви вже обслуговуєте цього клієнта.");
    else return ctx.reply("⛔ Клієнта вже обслуговує інший менеджер.");
  }

  assignClient(clientId, managerId);
  await ctx.reply(`✅ Ви взяли клієнта ${clientId}`);
  await ctx.reply(
    "🔚 Коли завершите спілкування, натисніть кнопку нижче:",
    Markup.inlineKeyboard([
      Markup.button.callback("Завершити діалог", `end_${clientId}`),
    ])
  );

  await bot.telegram.sendMessage(
    clientId,
    "👤 Менеджер приєднався до чату. Ви можете писати повідомлення."
  );

  for (const entry of inviteMessages[clientId] || []) {
    if (entry.managerId !== managerId) {
      await bot.telegram.editMessageReplyMarkup(
        entry.managerId,
        entry.messageId,
        null,
        {
          inline_keyboard: [
            [
              {
                text: "⛔ Клієнт вже обслуговується",
                callback_data: "disabled",
              },
            ],
          ],
        }
      );
    }
  }

  delete inviteMessages[clientId];
  delete userData[clientId];
});

bot.action(/^end_(\d+)$/, async (ctx) => {
  const managerId = ctx.from.id;
  const clientId = ctx.match[1];

  const assignedManager = getManagerByClient(clientId);
  if (!assignedManager || assignedManager != managerId) {
    return ctx.reply("⛔ Ви не ведете цього клієнта.");
  }

  removeSession(clientId);
  await bot.telegram.sendMessage(
    clientId,
    "✅ Дякуємо за звернення! Якщо виникнуть ще питання — звертайтесь 🧡"
  );
  ctx.reply("🟢 Діалог завершено.");
});

bot.action("disabled", (ctx) => {
  ctx.answerCbQuery("⛔ Цей клієнт вже обслуговується");
});

bot.command("add_manager", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Немає доступу.");
  const args = ctx.message.text.split(" ");
  const id = parseInt(args[1]);
  const name = args.slice(2).join(" ") || "Без імені";
  if (!id) return ctx.reply("❗ Використання: /add_manager <id> <ім’я>");
  addManager(id, name);
  ctx.reply(`✅ Менеджер ${name} (${id}) доданий.`);
});

bot.command("remove_manager", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Немає доступу.");
  const args = ctx.message.text.split(" ");
  const id = parseInt(args[1]);
  if (!id) return ctx.reply("❗ Використання: /remove_manager <id>");
  removeManager(id);
  ctx.reply(`🗑 Менеджер з ID ${id} видалений.`);
});

bot.command("list_managers", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ Немає доступу.");
  const list = listManagers();
  if (list.length === 0) return ctx.reply("📭 Менеджери не додані.");
  ctx.reply(
    "📋 Список менеджерів:\n" +
      list.map((m) => `👤 ${m.name} (ID: ${m.id})`).join("\n")
  );
});

bot
  .launch()
  .then(() => console.log("🤖 Бот успішно запущений"))
  .catch((err) => console.error("❌ Помилка при запуску:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
