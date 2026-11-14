import { Suspense } from "react";
import View from "./view";

// Client-rendered behind the admin auth check — opt out of instant-navigation validation.
export const instant = false;

export default function Page() {
  // useParams() suspends for request-time params under Cache Components
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
