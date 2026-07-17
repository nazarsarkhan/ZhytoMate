import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Conversation, toPublicConversation } from "../src/features/conversation/conversation.model.js";
import { assistantFeedbackSchema } from "../src/features/assistant/assistantFeedback.schema.js";

test("conversation messages expose stable IDs for assistant feedback", () => {
  assert.equal(Conversation.schema.path("messages").schema.options._id, true);

  const messageId = new mongoose.Types.ObjectId();
  const conversation = {
    _id: new mongoose.Types.ObjectId(),
    title: "Транспорт",
    messages: [{ _id: messageId, role: "assistant", text: "Ось відповідь", actionCard: null }],
    pendingAction: null,
    lastMessageAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert.equal(toPublicConversation(conversation).messages[0].id, messageId.toString());
});

test("feedback schema accepts a downvote reason and rejects unknown values", () => {
  const valid = assistantFeedbackSchema.validate({
    messageId: new mongoose.Types.ObjectId().toString(),
    conversationId: new mongoose.Types.ObjectId().toString(),
    vote: "down",
    reason: "missing_information",
    userQuery: "Де ЦНАП?",
    answer: "Не знаю",
    answerStatus: "ungrounded",
    verified: false,
    sourcesUsed: ["manual-curated"],
    appLinks: [],
  });
  assert.equal(valid.error, undefined);

  const invalid = assistantFeedbackSchema.validate({
    messageId: new mongoose.Types.ObjectId().toString(),
    vote: "sideways",
    reason: "made_up_reason",
  });
  assert.ok(invalid.error);
});
