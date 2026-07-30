import styles from "./BrandName.module.css";

export function BrandName({ showTooltip = true }: { showTooltip?: boolean }) {
  return (
    <span className={styles.brand}>
      Kairos
      {showTooltip && (
        <span className={styles.tooltip}>Greek: &ldquo;the right, opportune moment&rdquo;</span>
      )}
    </span>
  );
}
