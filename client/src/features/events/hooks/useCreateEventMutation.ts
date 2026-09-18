import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { queryKeys } from "@/lib/query-keys";
import { createEventRequest } from "../api/events.api";
import type { CreateEventInput } from "../schemas/events.schemas";

export function useCreateEventMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: CreateEventInput) => createEventRequest(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
      navigate(`/events/${data.id}`);
    },
  });
}
