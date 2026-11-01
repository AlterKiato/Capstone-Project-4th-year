import "server-only";
import { db } from "@/lib/db";
import { pushDeliveryConfiguration } from "@/lib/push/config";
import { createResearchPushDelivery } from "@/lib/push/delivery";
import { createPushTransport } from "@/lib/push/transport";
import { createPushDeliveryRepository } from "@/lib/repositories/push-delivery.repository";

export const deliverResearchPush = createResearchPushDelivery({ configuration: pushDeliveryConfiguration,
    repository: createPushDeliveryRepository(db), transport: createPushTransport() });
