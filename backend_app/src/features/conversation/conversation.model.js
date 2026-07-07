import mongoose from "mongoose";

const TITLE_MAX_LENGTH = 60;

const actionCardSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    summary: { type: String, required: true, trim: true },
    slots: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true, trim: true },
    // Present only on an assistant message that's a confirm/cancel summary card rather than a
    // plain reply - see docs/superpowers/specs/2026-07-06-assistant-actions-framework-design.md.
    actionCard: { type: actionCardSchema, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
);

const pendingActionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    status: { type: String, enum: ["collecting", "confirming"], required: true },
    slots: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
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
    // In-progress assistant action draft (e.g. collecting appeal details), independent of the
    // message list so it survives the user asking unrelated questions mid-flow. null when no
    // action is in progress.
    pendingAction: { type: pendingActionSchema, default: null },
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
      actionCard: message.actionCard || null,
      createdAt: message.createdAt,
    })),
    pendingAction: conversation.pendingAction || null,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export default Conversation;
