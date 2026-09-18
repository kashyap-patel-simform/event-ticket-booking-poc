import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/features/auth/schemas/auth.schemas";
import { useLoginMutation } from "@/features/auth/hooks/useLoginMutation";
import { ApiError } from "@/lib/api-client";

function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const loginMutation = useLoginMutation();

  const onSubmit = (input: LoginInput) => loginMutation.mutate(input);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
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
                  autoComplete="current-password"
                  {...register("password")}
                />
                <FieldError errors={errors.password ? [errors.password] : undefined} />
              </Field>
              {loginMutation.isError && (
                <p className="text-sm text-destructive">
                  {loginMutation.error instanceof ApiError
                    ? loginMutation.error.message
                    : "Something went wrong. Please try again."}
                </p>
              )}
              <Button type="submit" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Logging in…" : "Log in"}
              </Button>
            </FieldGroup>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;
