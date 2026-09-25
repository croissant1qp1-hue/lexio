import LernenSeite from "./lernen-seite";

// Next 16: params ist in Server Components ein Promise.
export default async function Seite(props: { params: Promise<{ set: string }> }) {
    const { set } = await props.params;
    return <LernenSeite setSlug={set} />;
}
