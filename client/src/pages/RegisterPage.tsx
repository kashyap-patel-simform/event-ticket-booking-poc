import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas/auth.schemas";
import { useRegisterMutation } from "@/features/auth/hooks/useRegisterMutation";
import { ApiError } from "@/lib/api-client";

function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const registerMutation = useRegisterMutation();

  const onSubmit = (input: RegisterInput) => registerMutation.mutate(input);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" autoComplete="name" {...register("name")} />
                <FieldError errors={errors.name ? [errors.name] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
                <FieldError errors={errors.email ? [errors.email] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register("password")}
                />
                <FieldError errors={errors.password ? [errors.password] : undefined} />
              </Field>
              {registerMutation.isError && (
                <p className="text-sm text-destructive">
                  {registerMutation.error instanceof ApiError
                    ? registerMutation.error.message
                    : "Something went wrong. Please try again."}
                </p>
              )}
              <Button type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Registering…" : "Register"}
              </Button>
            </FieldGroup>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterPage;
