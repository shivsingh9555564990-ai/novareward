import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Register from "./pages/Register";
import Login from "./pages/Login";
import VerifyOtp from "./pages/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProfileSetup from "./pages/ProfileSetup";
import Interests from "./pages/Interests";
import Home from "./pages/Home";
import Earn from "./pages/Earn";
import SpinWheel from "./pages/SpinWheel";
import ScratchCard from "./pages/ScratchCard";
import Wallet from "./pages/Wallet";
import Redeem from "./pages/Redeem";
import MyRedemptions from "./pages/MyRedemptions";
import EarnMore from "./pages/EarnMore";
import SurveyDetail from "./pages/SurveyDetail";
import TaskDetail from "./pages/TaskDetail";
import Games from "./pages/Games";
import TapCoin from "./pages/games/TapCoin";
import MemoryMatch from "./pages/games/MemoryMatch";
import LuckyDice from "./pages/games/LuckyDice";
import Refer from "./pages/Refer";
import Quiz from "./pages/Quiz";
import Profile from "./pages/Profile";
import Transactions from "./pages/Transactions";
import Notifications from "./pages/Notifications";
import Leaderboard from "./pages/Leaderboard";
import Discover from "./pages/Discover";
import Friends from "./pages/Friends";
import FriendRequests from "./pages/FriendRequests";
import UserProfile from "./pages/UserProfile";
import AuthCallback from "./pages/AuthCallback";
import DebugDevice from "./pages/DebugDevice";
import Settings from "./pages/Settings";
import ChangePassword from "./pages/ChangePassword";
import PaymentMethods from "./pages/PaymentMethods";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/interests" element={<Interests />} />
            <Route path="/home" element={<Home />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/spin" element={<SpinWheel />} />
            <Route path="/scratch" element={<ScratchCard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/redeem" element={<Redeem />} />
            <Route path="/my-redemptions" element={<MyRedemptions />} />
            <Route path="/earn-more" element={<EarnMore />} />
            <Route path="/survey/:id" element={<SurveyDetail />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/tap-coin" element={<TapCoin />} />
            <Route path="/games/memory-match" element={<MemoryMatch />} />
            <Route path="/games/lucky-dice" element={<LuckyDice />} />
            <Route path="/refer" element={<Refer />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friend-requests" element={<FriendRequests />} />
            <Route path="/u/:id" element={<UserProfile />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/debug/device" element={<DebugDevice />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/payment-methods" element={<PaymentMethods />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
