import mongoose from "mongoose";

const assistantFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    userQuery: { type: String, default: "", trim: true, maxlength: 1000 },
    answer: { type: String, default: "", trim: true, maxlength: 12000 },
    vote: { type: String, enum: ["up", "down"], required: true },
    reason: {
      type: String,
      enum: ["incorrect_answer", "missing_information", "outdated_information", "poor_sources", "unclear_answer", null],
      default: null,
    },
    answerStatus: { type: String, default: "", trim: true, maxlength: 40 },
    verified: { type: Boolean, default: false },
    sourcesUsed: { type: [String], default: [] },
    appLinks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

assistantFeedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export const AssistantFeedback = mongoose.model("AssistantFeedback", assistantFeedbackSchema);

export default AssistantFeedback;
