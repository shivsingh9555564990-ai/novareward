import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import rewardsImg from "@/assets/onboarding-rewards.jpg";
import gamesImg from "@/assets/onboarding-games.jpg";
import redeemImg from "@/assets/onboarding-redeem.jpg";
import leaderboardImg from "@/assets/onboarding-leaderboard.jpg";

const slides = [
  {
    image: rewardsImg,
    title: "Earn Real Rewards",
    desc: "Surveys, offers, daily check-ins से coins कमाओ। हर task पर guaranteed reward।",
  },
  {
    image: gamesImg,
    title: "Play & Win Daily",
    desc: "Spin wheel, scratch cards, quizzes और games — बस खेलो और जीतो।",
  },
  {
    image: redeemImg,
    title: "Redeem Instantly",
    desc: "150+ gift cards या direct UPI transfer। ₹10 से redeem शुरू।",
  },
  {
    image: leaderboardImg,
    title: "Compete & Climb",
    desc: "Leaderboards पर top करो, badges जीतो, friends को refer करके extra पाओ।",
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const isLast = index === slides.length - 1;

  const finish = () => {
    localStorage.setItem("novarewards-onboarded", "1");
    navigate("/register", { replace: true });
  };

  const next = () => (isLast ? finish() : setIndex((i) => i + 1));

  const slide = slides[index];

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      <div className="flex justify-end px-6 pt-6">
        <button
          onClick={finish}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div key={index} className="w-full flex flex-col items-center animate-scale-in">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-primary blur-3xl opacity-30 rounded-full" />
            <img
              src={slide.image}
              alt={slide.title}
              width={320}
              height={320}
              className="relative w-72 h-72 object-cover rounded-3xl shadow-elevated"
            />
          </div>
          <h2 className="text-3xl font-bold text-center mb-3">{slide.title}</h2>
          <p className="text-center text-muted-foreground leading-relaxed">{slide.desc}</p>
        </div>
      </div>

      <div className="px-6 pb-10 max-w-md mx-auto w-full">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-bounce ${
                i === index ? "w-8 bg-gradient-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <Button variant="hero" size="xl" className="w-full" onClick={next}>
          {isLast ? "Get Started" : "Next"}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
