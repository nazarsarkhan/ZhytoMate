import mongoose from 'mongoose';

const placesSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    subtype: { type: String, required: true },
    address: { type: String, default: null },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
    phone: { type: String, default: null },
    openingHours: { type: String, default: null },
    sourceUrl: { type: String, required: true },
    source: { type: String, required: true },
    catalogUpdatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

placesSchema.index({ location: '2dsphere' });
placesSchema.pre('validate', function setLocation(next) {
  this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
  next();
});

export const Place = mongoose.model('Place', placesSchema);
export default Place;
