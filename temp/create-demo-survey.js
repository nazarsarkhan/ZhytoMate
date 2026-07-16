const dbz = db.getSiblingDB("zhytomate");
const now = new Date();
const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const title = "Який міський сервіс покращити першим?";

const result = dbz.surveys.updateOne(
  { title },
  {
    $set: {
      title,
      description: "Оберіть напрям, який місту варто зробити пріоритетом найближчим часом.",
      category: "Міські сервіси",
      startsAt: now,
      endsAt: ends,
      isActive: true,
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
      options: [
        { _id: new ObjectId(), label: "Графік руху транспорту" },
        { _id: new ObjectId(), label: "Повідомлення про відключення світла" },
        { _id: new ObjectId(), label: "Онлайн-звернення до служб" },
        { _id: new ObjectId(), label: "Міські новини та оголошення" },
      ],
    },
  },
  { upsert: true },
);

printjson(result);
printjson(dbz.surveys.findOne(
  { title },
  { title: 1, description: 1, category: 1, options: 1, startsAt: 1, endsAt: 1, isActive: 1 },
));
