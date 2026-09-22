import { useMutation } from "@tanstack/react-query";
import { createCheckoutRequest } from "../api/payments.api";

export function useCreateCheckoutMutation() {
  return useMutation({
    mutationFn: (holdId: string) => createCheckoutRequest(holdId),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl; // real browser redirect to Stripe's hosted page
    },
  });
}
