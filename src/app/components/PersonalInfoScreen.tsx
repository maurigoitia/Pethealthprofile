import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface PersonalInfoScreenProps {
  onBack: () => void;
}

export function PersonalInfoScreen({ onBack }: PersonalInfoScreenProps) {
  const [formData, setFormData] = useState(() => {
    const stored = localStorage.getItem("pessy_user_info");
    return stored
      ? JSON.parse(stored)
      : {
          name: "Diego Martínez",
          email: "diego@email.com",
          phone: "+54 9 11 1234-5678",
          photo: "",
        };
  });

  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("La imagen es muy grande. Máximo 5MB.");
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photo: "" });
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save
    setTimeout(() => {
      // Save to localStorage
      localStorage.setItem("pessy_user_info", JSON.stringify(formData));
      setIsSaving(false);
      alert("Información guardada exitosamente");
    }, 500);
  };

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Información Personal
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Photo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
              Foto de perfil
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.photo ? (
                  <img
                    src={formData.photo}
                    alt="Foto de perfil"
                    className="size-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-lg"
                  />
                ) : (
                  <div className="size-24 rounded-full bg-gradient-to-br from-[#2b7cee] to-[#5a8aff] flex items-center justify-center text-white shadow-lg">
                    <MaterialIcon name="person" className="text-5xl" />
                  </div>
                )}
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 size-8 rounded-full bg-[#2b7cee] text-white flex items-center justify-center cursor-pointer hover:bg-[#5a8aff] transition-colors shadow-lg"
                >
                  <MaterialIcon name="photo_camera" className="text-lg" />
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  JPG, PNG o GIF. Máximo 5MB.
                </p>
                {formData.photo && (
                  <button
                    onClick={handleRemovePhoto}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Eliminar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Nombre completo
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b7cee] focus:border-transparent"
              placeholder="Tu nombre"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b7cee] focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b7cee] focus:border-transparent"
              placeholder="+54 9 11 1234-5678"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 rounded-xl bg-[#2b7cee] text-white font-bold hover:bg-[#5a8aff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}