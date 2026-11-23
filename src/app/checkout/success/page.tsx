import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id: checkoutSession } = await searchParams;
  const user = await getCurrentUser();
  const order = user && checkoutSession
    ? await prisma.order.findFirst({
        where: { stripeCheckoutSession: checkoutSession, buyerId: user.id },
        select: { status: true, listing: { select: { title: true } } }
      })
    : null;
  const paid = order?.status === "PAID";
  return (
    <main className="checkout-result">
      {paid ? <CheckCircle2 size={42} /> : <Clock3 size={42} />}
      <h1>{paid ? "გადახდა დადასტურებულია" : "გადახდა მუშავდება"}</h1>
      <p>{paid
        ? `შეძენა დასრულდა — ${order?.listing.title}.`
        : "გადახდის დადასტურებას ველოდებით ბანკისგან. შეკვეთის სტატუსი განახლდება უსაფრთხო გადახდის შეტყობინების მიღების შემდეგ."}</p>
      <Link href="/">მთავარ გვერდზე დაბრუნება</Link>
    </main>
  );
}
