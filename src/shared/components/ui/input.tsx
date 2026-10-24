"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de texto base. `forwardRef` para que el `ref` de react-hook-form
 * (`register`) y cualquier foco programático funcionen — antes se perdía en
 * silencio porque era un componente de función sin ref.
 *
 * Cuando `type="password"` muestra un botón de ojo para ver lo escrito
 * (BUG-013). Resolverlo aquí cubre de una los 7 campos de contraseña de la app
 * (login, registro, reset, cambio, borrar cuenta, staff) en lugar de parchear
 * cada formulario, y cualquier campo de contraseña futuro lo hereda.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type, ...props }, ref) {
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";

  const input = (
    <input
      ref={ref}
      type={isPassword ? (show ? "text" : "password") : type}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        isPassword && "pr-10",
        className,
      )}
      {...props}
    />
  );

  if (!isPassword) return input;

  return (
    <div className="relative">
      {input}
      <button
        type="button"
        // Fuera del orden de tabulación: es una ayuda visual, no un paso del
        // formulario, y no debe interponerse entre el campo y el botón de envío.
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {show ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});

export { Input };
