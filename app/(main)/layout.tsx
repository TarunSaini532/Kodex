import { verifyToken } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { cookies } from "next/headers";
import React from "react";
import Nav from "@/components/Nav";
import { redirect } from "next/navigation";

export type NavUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  knownConcepts: IUser["knownConcepts"];
  experienceLevel: IUser["experienceLevel"];
};

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let user = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload && typeof payload !== "string" && payload.userId) {
      await connectDB();
      user = await User.findById(payload.userId)
        .select("name email experienceLevel")
        .lean();
    }
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <Nav user={user} />
      <main className="pt-14">{children}</main>
    </div>
  );
}
