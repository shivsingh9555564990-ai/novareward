// Nova Coin economy + helpers
// Conversion: 120 Nova Coins = ₹10 → 1 NC = ₹0.0833...
export const NOVA_PER_RUPEE = 12; // 120 NC = ₹10
export const novaToRupees = (coins: number) => coins / NOVA_PER_RUPEE;
export const formatRupees = (coins: number) =>
  `₹${novaToRupees(coins).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};
