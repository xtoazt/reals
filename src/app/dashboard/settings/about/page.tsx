
// src/app/dashboard/settings/about/page.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-2xl">About RealTalk</CardTitle>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
            I just made this so that people wouldn't have to use a Google Doc to talk or risk silent lunch lol.
            {"\n\n"}
            My username is rohan., anyone else is a fake.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
