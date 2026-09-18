import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateEventMutation } from "@/features/events/hooks/useCreateEventMutation";
import {
  createEventFormSchema,
  type CreateEventFormInput,
  type CreateEventFormValues,
} from "@/features/events/schemas/events.schemas";
import { ApiError } from "@/lib/api-client";

function CreateEventPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEventFormValues, unknown, CreateEventFormInput>({
    resolver: zodResolver(createEventFormSchema),
  });
  const createEventMutation = useCreateEventMutation();

  const onSubmit = (input: CreateEventFormInput) =>
    createEventMutation.mutate({
      name: input.name,
      date: input.date,
      venue: input.venue,
      priceCents: Math.round(input.price * 100),
      seatCount: input.seatCount,
    });

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" {...register("name")} />
                <FieldError errors={errors.name ? [errors.name] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="date">Date</FieldLabel>
                <Input id="date" type="date" {...register("date")} />
                <FieldError errors={errors.date ? [errors.date] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="venue">Venue</FieldLabel>
                <Input id="venue" {...register("venue")} />
                <FieldError errors={errors.venue ? [errors.venue] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="price">Price</FieldLabel>
                <Input id="price" type="number" step="0.01" min="0" {...register("price")} />
                <FieldError errors={errors.price ? [errors.price] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="seatCount">Seat count</FieldLabel>
                <Input id="seatCount" type="number" min="1" max="500" {...register("seatCount")} />
                <FieldError errors={errors.seatCount ? [errors.seatCount] : undefined} />
              </Field>
              {createEventMutation.isError && (
                <p className="text-sm text-destructive">
                  {createEventMutation.error instanceof ApiError
                    ? createEventMutation.error.message
                    : "Something went wrong. Please try again."}
                </p>
              )}
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? "Creating…" : "Create Event"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default CreateEventPage;
