import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { MessageSquare, Trash2, Users, WalletCards } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/admin-auth";
import { logout } from "./login/actions";
import { deleteFeedback, deleteWaitlistEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!isValidAdminToken(jar.get(ADMIN_COOKIE)?.value)) redirect("/admin/login");
  const [entries, feedback] = await Promise.all([
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const paidPlanIntent = entries.filter((entry) => ["Explorer", "Creator", "Pro"].includes(entry.selectedPlan)).length;
  return (
    <main className="admin-shell">
      <nav className="admin-nav"><span className="brand"><span className="brand-mark"><Image src="/logo.png" alt="" width={58} height={58} /></span> motioncraft <i>admin</i></span><form action={logout}><button className="ghost-button">Sign out</button></form></nav>
      <header className="admin-header"><div><p className="eyebrow">DEMAND SIGNALS</p><h1>Research dashboard</h1><p>Everything people have shared while you validate the idea.</p></div></header>
      <section className="stats">
        <div><Users/><span>{entries.length}</span><p>Waitlist members</p></div>
        <div><WalletCards/><span>{paidPlanIntent}</span><p>Selected a paid plan</p></div>
        <div><MessageSquare/><span>{feedback.length}</span><p>Feedback responses</p></div>
      </section>
      <section className="admin-panel"><div className="panel-title"><h2>Waitlist</h2><span>{entries.length} total</span></div><div className="table-wrap"><table><thead><tr><th>Person</th><th>Role & workflow</th><th>Plan</th><th>Primary use cases</th><th>Payment objection</th><th>Pain point</th><th>Joined</th><th>Action</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.name}</strong><small>{entry.email}</small></td><td>{entry.profession}<small>{entry.currentWorkflow}</small></td><td><b className="budget">{entry.selectedPlan}</b></td><td className="use-case-cell"><div>{entry.primaryUseCases.map((useCase) => <span key={useCase}>{useCase}</span>)}</div>{entry.primaryUseCaseOther && <small>{entry.primaryUseCaseOther}</small>}</td><td className="long-cell">{entry.paymentObjection}{entry.paymentObjectionOther && <small>{entry.paymentObjectionOther}</small>}</td><td className="long-cell">{entry.painPoint}</td><td>{entry.createdAt.toLocaleDateString()}</td><td><form action={deleteWaitlistEntry}><input type="hidden" name="id" value={entry.id}/><button className="delete-button" title={`Delete ${entry.email}`}><Trash2/>Delete</button></form></td></tr>)}</tbody></table></div>{!entries.length && <p className="empty">New registrations will appear here.</p>}</section>
      <section className="admin-panel"><div className="panel-title"><h2>Feedback</h2><span>{feedback.length} responses</span></div><div className="feedback-grid">{feedback.map((item) => <article key={item.id}><div><span>{item.category}</span><time>{item.createdAt.toLocaleDateString()}</time></div><p>{item.feedback}</p><small>{item.email || "Anonymous"}</small><form action={deleteFeedback}><input type="hidden" name="id" value={item.id}/><button className="delete-button feedback-delete" title="Delete feedback"><Trash2/>Delete</button></form></article>)}</div>{!feedback.length && <p className="empty">Feedback responses will appear here.</p>}</section>
    </main>
  );
}
