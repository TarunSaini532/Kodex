import connectDB from "@/lib/mongodb";
import Problem from "@/models/Problem";
import fs from "fs";
import path from "path";


const raw = fs.readFileSync(
  path.join(__dirname, "data/problems.json"),
  "utf-8",
);
const problems = JSON.parse(raw);

async function seed() {
  try {
    await connectDB();
    await Problem.deleteMany({});
    await Problem.insertMany(problems);
    console.log(`Seeded ${problems.length} problems`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
