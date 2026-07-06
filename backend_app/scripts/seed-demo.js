import { connectMongo, disconnectMongo } from "../src/shared/db.js";
import User from "../src/features/user/user.model.js";
import Appeal from "../src/features/appeal/appeal.model.js";
import { Survey } from "../src/features/survey/survey.model.js";
import { voteInSurvey } from "../src/features/survey/survey.service.js";

const username = "nazar_dev";

const demoAppeals = [
  {
    imageUrl: "https://example.com/demo/appeals/broken-street-light.jpg",
    category: "street_lighting",
    description: "Broken street light near the main entrance.",
    address: "Kyivska St, 12",
  },
  {
    imageUrl: "https://example.com/demo/appeals/pothole.jpg",
    category: "pothole",
    description: "Large pothole on the road after heavy rain.",
    address: "Peremohy Square, 4",
  },
  {
    imageUrl: "https://example.com/demo/appeals/trash-bin.jpg",
    category: "garbage",
    description: "Overflowing trash bins near the playground.",
    address: "Shevchenka Blvd, 18",
  },
];

const demoSurveys = [
  {
    title: "City priority for July",
    description: "Choose what should be improved first this month.",
    options: ["Road repairs", "Parks", "Street lighting", "Shelters"],
    selectedOptionIndex: 0,
  },
  {
    title: "Best format for public updates",
    description: "Pick the most convenient format for city service updates.",
    options: ["Push notifications", "Email digest", "Telegram channel"],
    selectedOptionIndex: 2,
  },
  {
    title: "Community event topic",
    description: "Choose the topic for the next local community event.",
    options: ["Safety workshop", "Digital services", "Urban cleanup"],
    selectedOptionIndex: 1,
  },
];

async function findNazarDev() {
  return User.findOne({
    $or: [{ username }, { email: username.toLowerCase() }],
  });
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

async function seedSurveysAndVotes(user) {
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

    const option = survey.options[surveyData.selectedOptionIndex];
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

  return { createdSurveys, savedVotes };
}

async function main() {
  await connectMongo();

  const user = await findNazarDev();
  if (!user) {
    throw new Error('User "nazar_dev" was not found. Register it first.');
  }

  const createdAppeals = await seedAppeals(user);
  const { createdSurveys, savedVotes } = await seedSurveysAndVotes(user);

  console.log(`Seeded demo data for ${username}:`);
  console.log(`- appeals created: ${createdAppeals}`);
  console.log(`- surveys created: ${createdSurveys}`);
  console.log(`- votes saved: ${savedVotes}`);
}

main()
  .catch((err) => {
    console.error("[seed-demo] failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
