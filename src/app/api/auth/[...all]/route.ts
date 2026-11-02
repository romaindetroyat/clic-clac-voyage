import { getAuth } from "@/server/auth";

async function gerer(req: Request) {
  const auth = await getAuth();
  return auth.handler(req);
}

export { gerer as GET, gerer as POST };
