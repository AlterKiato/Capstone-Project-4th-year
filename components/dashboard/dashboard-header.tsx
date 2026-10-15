import Link from "next/link";

export default function DashboardHeader({ title, email }: { title: string; email: string }) {
    return (
        <header className="dashboard-header">
            <div>
                <Link className="product-name" href="/dashboard">ThesiSHS AI</Link>
                <h1>{title}</h1>
                <p className="dashboard-welcome">Welcome, {email}</p>
            </div>
        </header>
    );
}
