"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Static card for integrations wired purely via env vars (no OAuth, no
 * "Link" affordance). Pass `envConfigured` so the badge reflects reality
 * instead of always reading "Not configured".
 */
export default function StaticCard({
  name,
  description,
  envConfigured,
  envHint,
}: {
  name: string;
  description: string;
  envConfigured?: boolean;
  envHint?: string;
}) {
  // envConfigured===undefined preserves the legacy "always shows Not
  // configured" behaviour for cards that aren't actually checking env.
  const connected = envConfigured === true;
  const showStatusBadge = envConfigured !== undefined;

  return (
    <Card className="bg-surface border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{name}</CardTitle>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-wider",
            showStatusBadge && connected && "border-ok/40 text-ok",
            showStatusBadge && !connected && "border-warning/40 text-warning",
          )}
        >
          {connected ? "Connected" : "Not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-text-secondary text-xs">{description}</p>
        {envConfigured === false && envHint && (
          <p className="text-text-tertiary text-[11px]">{envHint}</p>
        )}
        {envConfigured === undefined && (
          <Button variant="outline" size="sm" disabled>
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
