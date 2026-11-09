import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="wrap page-head">
      <h1 className="h1">Not found</h1>
      <p className="lede">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <p>
        <Link href="/" className="btn btn-line">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
