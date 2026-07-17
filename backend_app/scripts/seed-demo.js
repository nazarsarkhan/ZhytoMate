import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectMongo, disconnectMongo } from "../src/shared/db.js";
import User from "../src/features/user/user.model.js";
import Appeal from "../src/features/appeal/appeal.model.js";
import { Survey } from "../src/features/survey/survey.model.js";
import { Contact } from "../src/features/contact/contact.model.js";
import { Setting } from "../src/features/setting/setting.model.js";
import { voteInSurvey } from "../src/features/survey/survey.service.js";

const __filename = fileURLToPath(import.meta.url);

// These credentials are intentionally predictable because this script is for local/staging demo
// data. Never use them for a public production deployment; override them through the environment
// or change them immediately after seeding.
const demoAccounts = Object.freeze([
  {
    username: "admin",
    firstName: "Міський",
    lastName: "Адміністратор",
    email: "admin@zhytomate.local",
    password: process.env.ADMIN_SEED_PASSWORD || "ZhytomyrAdmin2026!",
    role: "admin",
  },
  {
    username: "demo_user",
    firstName: "Олена",
    lastName: "Коваль",
    email: "demo.user@zhytomate.local",
    password: process.env.DEMO_USER_SEED_PASSWORD || "ZhytomyrUser2026!",
    role: "user",
  },
  {
    username: "demo_user2",
    firstName: "Андрій",
    lastName: "Мельник",
    email: "demo.user2@zhytomate.local",
    password: process.env.DEMO_USER2_SEED_PASSWORD || "ZhytomyrUser22026!",
    role: "user",
  },
]);

// Mirrors the previously-static contacts from frontend_app/src/consts/serviceData.js so the
// Contacts tab has data once it reads from the API. `kind:"emergency"` renders in the top grid;
// `kind:"utility"` rows are grouped under their `group` heading.
export const demoContacts = [
  { name: "Пожежна", phone: "101", icon: "local_fire_department", kind: "emergency", group: "" },
  { name: "Поліція", phone: "102", icon: "local_police", kind: "emergency", group: "" },
  { name: "Швидка", phone: "103", icon: "medical_services", kind: "emergency", group: "" },
  { name: "Служба газу", phone: "104", icon: "gas_meter", kind: "emergency", group: "" },
  { name: "Водоканал", phone: "0412 24-08-10", icon: "water_drop", kind: "utility", group: "Комунальні служби" },
  { name: "Обленерго", phone: "0 800 30-92-82", icon: "bolt", kind: "utility", group: "Комунальні служби" },
  { name: "Теплокомуненерго", phone: "0412 48-14-14", icon: "hvac", kind: "utility", group: "Комунальні служби" },
  { name: "Ліфтсервіс", phone: "0412 42-20-80", icon: "elevator", kind: "utility", group: "Комунальні служби" },
  { name: "ЦНАП", phone: "0412 47-06-15", icon: "account_balance", kind: "utility", group: "Соціальні та адмін послуги" },
  { name: "Соцзахист", phone: "0412 47-09-17", icon: "family_restroom", kind: "utility", group: "Соціальні та адмін послуги" },
];

export const demoPublicSettings = Object.freeze({
  cityHotline: "15-80",
});

const demoAppeals = [
  {
    imageUrl: "https://example.com/demo/appeals/broken-street-light.jpg",
    category: "street_lighting",
    description: "Broken street light near the main entrance.",
    address: "Kyivska St, 12",
    status: "resolved",
    response:
      "Дякуємо за звернення! Ліхтар відремонтовано бригадою КП «Міськсвітло». Освітлення відновлено, роботи прийнято.",
  },
  {
    imageUrl: "https://example.com/demo/appeals/pothole.jpg",
    category: "pothole",
    description: "Large pothole on the road after heavy rain.",
    address: "Peremohy Square, 4",
    status: "in_progress",
    response:
      "Звернення прийнято в роботу. Ділянку внесено до графіка ямкового ремонту, орієнтовний термін — 5 робочих днів.",
  },
  {
    imageUrl: "https://example.com/demo/appeals/trash-bin.jpg",
    category: "garbage",
    description: "Overflowing trash bins near the playground.",
    address: "Shevchenka Blvd, 18",
    status: "new",
    response: "",
  },
];

const demoSurveys = [
  {
    title: "Що найперше покращити в Житомирі?",
    description: "Оберіть напрям, який, на вашу думку, має бути міським пріоритетом.",
    options: ["Ремонт доріг", "Освітлення вулиць", "Парки та сквери", "Громадський транспорт"],
    selectedOptionIndex: 0,
  },
  {
    title: "Які міські сервіси потрібні в застосунку?",
    description: "Допоможіть визначити, які функції будуть найкориснішими для мешканців Житомира.",
    options: ["Повідомлення про проблеми", "Міські новини", "Графіки відключень", "Події та заходи"],
    selectedOptionIndex: 1,
  },
];

async function upsertDemoAccount(account) {
  let user = await User.findOne({
    $or: [{ username: account.username }, { email: account.email }],
  });

  if (!user) {
    user = await User.create({
      ...account,
      password: await bcrypt.hash(account.password, 12),
    });
    return { user, created: true };
  }

  user.firstName = account.firstName;
  user.lastName = account.lastName;
  user.email = account.email;
  user.role = account.role;
  user.isActive = true;

  if (!(await bcrypt.compare(account.password, user.password))) {
    user.password = await bcrypt.hash(account.password, 12);
    user.refreshTokenVersion += 1;
  }

  await user.save();
  return { user, created: false };
}

async function seedUsers() {
  const users = [];
  let created = 0;

  for (const account of demoAccounts) {
    const result = await upsertDemoAccount(account);
    users.push(result.user);
    created += result.created ? 1 : 0;
  }

  return { users, created };
}

async function seedAppeals(user) {
  let created = 0;

  for (const appeal of demoAppeals) {
    const existing = await Appeal.findOne({
      user: user._id,
      description: appeal.description,
      address: appeal.address,
    });

    if (existing) {
      // Keep demo status/response in sync on re-runs so the detail page always has data to show.
      // Also backfill category, since appeals seeded before the category taxonomy existed lack it
      // and would otherwise fail the model's required-category validation on save().
      existing.category = appeal.category;
      existing.status = appeal.status;
      existing.response = appeal.response;
      await existing.save();
      continue;
    }

    await Appeal.create({
      user: user._id,
      ...appeal,
    });
    created += 1;
  }

  return created;
}

async function seedSurveysAndVotes(users) {
  let createdSurveys = 0;
  let savedVotes = 0;

  for (const surveyData of demoSurveys) {
    let survey = await Survey.findOne({ title: surveyData.title });

    if (!survey) {
      survey = await Survey.create({
        title: surveyData.title,
        description: surveyData.description,
        options: surveyData.options.map((label) => ({ label })),
        isActive: true,
      });
      createdSurveys += 1;
    }

    for (const [userIndex, user] of users.entries()) {
      const optionIndex =
        (surveyData.selectedOptionIndex + userIndex) % survey.options.length;
      const option = survey.options[optionIndex];
      if (!option) {
        throw new Error(`Demo option is missing for survey "${survey.title}"`);
      }

      await voteInSurvey({
        surveyId: survey._id.toString(),
        userId: user._id.toString(),
        optionId: option._id.toString(),
      });
      savedVotes += 1;
    }
  }

  return { createdSurveys, savedVotes };
}

export async function seedContacts() {
  let created = 0;

  for (const [index, contact] of demoContacts.entries()) {
    const existing = await Contact.findOne({ name: contact.name });
    if (existing) {
      continue;
    }

    await Contact.create({ ...contact, order: index, isActive: true });
    created += 1;
  }

  return created;
}

export async function seedPublicSettings() {
  let created = 0;

  for (const [key, value] of Object.entries(demoPublicSettings)) {
    const existing = await Setting.findOne({ key });
    if (existing) {
      continue;
    }

    await Setting.create({ key, value });
    created += 1;
  }

  return created;
}

export async function main() {
  await connectMongo();

  const { users, created: createdUsers } = await seedUsers();
  const primaryUser = users.find((user) => user.username === "demo_user");
  const { createdSurveys, savedVotes } = await seedSurveysAndVotes(users);
  const createdAppeals = await seedAppeals(primaryUser);
  const createdContacts = await seedContacts();
  const ensuredPublicSettings = await seedPublicSettings();

  console.log("Seeded demo data for Zhytomyr:");
  console.log(`- users created: ${createdUsers}`);
  console.log(`- appeals created: ${createdAppeals}`);
  console.log(`- surveys created: ${createdSurveys}`);
  console.log(`- votes saved: ${savedVotes}`);
  console.log(`- contacts created: ${createdContacts}`);
  console.log(`- public settings ensured: ${ensuredPublicSettings}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error("[seed-demo] failed:", err.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectMongo();
    });
}
