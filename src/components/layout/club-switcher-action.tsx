"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ClubSwitcherAction() {
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href="/">
        <ArrowLeftRight className="size-3.5" />
        다른 클럽
      </Link>
    </Button>
  );
}
