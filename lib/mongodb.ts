import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env.local") });

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// This is the TYPE of the mongoose module itself
// i.e. the entire namespace — all its methods, properties, classes
// typeof mongoose = {
//   connect: Function,
//   connection: Connection,
//   model: Function,
//   Schema: Class,
//   Types: Object,
  // ... everything mongoose exports
// }

declare global {
  var mongoose: MongooseCache;
}

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Mongo db url is not defined .env.local");
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };
global.mongoose = cached;

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;