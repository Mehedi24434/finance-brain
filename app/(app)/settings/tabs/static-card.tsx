"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StaticCard({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <Card className="bg-surface border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{name}</CardTitle>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          Not configured
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-text-secondary text-xs">{description}</p>
        <Button variant="outline" size="sm" disabled>
          Connect
        </Button>
      </CardContent>
    </Card>
  );
}
