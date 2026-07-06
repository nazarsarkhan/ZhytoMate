import mongoose from "mongoose";

const TITLE_MAX_LENGTH = 60;

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ user: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);

export function deriveConversationTitle(firstUserMessage) {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= TITLE_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`;
}

export function toPublicConversationSummary(conversation) {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    lastMessage: lastMessage ? lastMessage.text : "",
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
  };
}

export function toPublicConversation(conversation) {
  return {
    id: conversation._id.toString(),
    title: conversation.title,
    messages: conversation.messages.map((message) => ({
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
    })),
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export default Conversation;
