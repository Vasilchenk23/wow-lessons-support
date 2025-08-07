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

bot.start((ctx) => {
  const id = ctx.from.id;
  if (isManager(id)) {
    ctx.reply("👔 Ви увійшли як менеджер.");
  } else {
    ctx.reply(
      "Привіт! Оберіть, що вас цікавить:",
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

    const clientUsername = ctx.from.username || ctx.from.first_name;
    const message = ctx.message.text;

    ctx.reply("Вітаємо! Зараз підключимо менеджера...");

    for (const manager of listManagers()) {
      await bot.telegram.sendMessage(
        manager.id,
        `❗Новий запит від @${clientUsername}\nТип: ${message}`,
        Markup.inlineKeyboard([
          Markup.button.callback(
            `🔗 Взяти клієнта ${clientId}`,
            `take_${clientId}`
          ),
          Markup.button.callback("❌ Відхилити", `decline_${clientId}`),
        ])
      );
    }
  }
);

bot.action(/^take_(\d+)$/, async (ctx) => {
  const managerId = ctx.from.id;
  const clientId = ctx.match[1];

  if (!isManager(managerId)) return;

  if (parseInt(clientId) === managerId) {
    return ctx.reply("⛔ Ви не можете обслуговувати самі себе.");
  }

  const current = getManagerByClient(clientId);
  if (current) {
    if (current == managerId) {
      return ctx.reply("✅ Ви вже обслуговуєте цього клієнта.");
    } else {
      return ctx.reply("⛔ Цей клієнт вже обслуговується іншим менеджером.");
    }
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

bot.on("message", async (ctx) => {
  const userId = ctx.from.id;
  const msg = ctx.message;

  if (isManager(userId)) {
    const clientId = getClientByManager(userId);
    if (clientId) {
      await bot.telegram.copyMessage(clientId, userId, msg.message_id);
    }
  } else {
    const managerId = getManagerByClient(userId);
    if (managerId) {
      await bot.telegram.copyMessage(managerId, userId, msg.message_id);
    } else {
      ctx.reply("🟡 Ваш запит ще не обробляється. Оберіть опцію з меню.");
    }
  }
});

bot.launch();
console.log("🤖 Бот запущено");
