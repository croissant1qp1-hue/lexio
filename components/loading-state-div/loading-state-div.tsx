export default function LoadingStateDiv() {
    return (
        <div style={{
                width: "100%",
                height: "100%",
                minHeight: "220px",
                margin: 0,
                borderRadius: "inherit",
                boxSizing: "border-box",
                background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-highlight) 50%, var(--skeleton-base) 75%)",
                backgroundSize: "200% 100%",
                animation: "pulse 1.4s ease-in-out infinite",
                boxShadow: "inset 0 0 0 1px rgba(101, 168, 141, 0.08)",}}>

        </div>
    )
}