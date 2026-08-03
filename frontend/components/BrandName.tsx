import styles from "./BrandName.module.css";

export function BrandName({ showTooltip = true }: { showTooltip?: boolean }) {
  return (
    <span
      className={styles.brand}
      title={showTooltip ? 'Greek: "the right, opportune moment"' : undefined}
    >
      Kairos
    </span>
  );
}
