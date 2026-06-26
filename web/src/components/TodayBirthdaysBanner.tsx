"use client";

import { useRouter } from "next/navigation";
import { MatterBirthdayBanner } from "@/components/matter/MatterBirthdayBanner";
import { useTodayBirthdays } from "@/components/TodayBirthdaysProvider";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import { matterHref } from "@/lib/matter-routes";

type Props = {
  billingAccess?: boolean;
};

export function TodayBirthdaysBanner({ billingAccess = true }: Props) {
  const router = useRouter();
  const { withReturn } = useMatterNavigation();
  const { pendingClients } = useTodayBirthdays();

  if (!billingAccess || pendingClients.length === 0) return null;

  return (
    <div className="today-birthdays-banners">
      {pendingClients.map((client) => (
        <MatterBirthdayBanner
          key={client.code}
          clientName={client.name || client.code}
          birthdayLabel={client.birthdayLabel}
          onOpen={() =>
            router.push(
              withReturn(
                matterHref(client.code, undefined, {
                  birthdayGreeting: true
                })
              )
            )
          }
        />
      ))}
    </div>
  );
}
