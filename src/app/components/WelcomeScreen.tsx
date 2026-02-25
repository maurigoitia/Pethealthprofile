import { useNavigate } from "react-router";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      navigate("/home");
    }
  }, [user, loading, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundImage: "linear-gradient(rgb(43, 124, 238) 0%, rgb(61, 139, 255) 50%, rgb(93, 163, 255) 100%)"
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-black text-[#2b7cee]">
          Pessy
        </h1>

        <p className="text-slate-500 mt-3 text-sm">
          Que su historia no se pierda.
        </p>

        <div className="mt-14 space-y-4">
          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 rounded-2xl bg-[#2b7cee] text-white font-bold hover:bg-[#256fe0] transition-all"
          >
            Ingresar
          </button>

          <button
            onClick={() => navigate("/register")}
            className="w-full py-4 rounded-2xl border-2 border-[#2b7cee] text-[#2b7cee] font-bold hover:bg-[#2b7cee]/5 transition-all"
          >
            Registrarse
          </button>
        </div>
      </div>
    </div>
  );
}
