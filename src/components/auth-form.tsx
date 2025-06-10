
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Palette, Sparkles, AtSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  displayName: z.string().min(2, { message: 'Display name must be at least 2 characters.' }).max(50).optional(), // For display purposes, actual username/profile name
  specialCode: z.string().optional(),
  nameColor: z.string().optional(), // Hex color
  title: z.string().optional(),
});

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showSpecialFields, setShowSpecialFields] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      specialCode: '',
      nameColor: '#FFA500', // Default to a theme orange
      title: '',
    },
  });

  const watchSpecialCode = form.watch('specialCode');

  React.useEffect(() => {
    if (watchSpecialCode === '1234') {
      setShowSpecialFields(true);
      toast({
        title: 'Special Mode Activated!',
        description: 'You can now set a custom name color and title.',
      });
    } else {
      setShowSpecialFields(false);
    }
  }, [watchSpecialCode, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // TODO: Implement Firebase Authentication and Profile Creation here
    // 1. Create user with email and password using Firebase Auth:
    //    `createUserWithEmailAndPassword(auth, values.email, values.password)`
    // 2. If successful, get the user (userCredential.user).
    // 3. Store additional profile information (displayName, nameColor, title) in Firebase Realtime Database or Firestore
    //    under a path like `/users/${user.uid}`.
    //    Example: `set(ref(database, 'users/' + user.uid), { displayName: values.displayName || values.email.split('@')[0], email: values.email, nameColor: values.nameColor, title: values.title });`

    console.log('Form values:', values);
    toast({
      title: 'Welcome!',
      description: `Logged in with ${values.email}. Profile setup would occur here.`,
    });
    // For now, redirect to dashboard.
    // In a real app, ensure auth state is managed (e.g., via Firebase onAuthStateChanged) before redirecting.
    router.push('/dashboard');
  }

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-center">real.</CardTitle>
        <CardDescription className="text-center">
          Enter your details to join or log in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><AtSign size={16} className="mr-2 opacity-70"/>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your preferred display name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="specialCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Code (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter special code if you have one" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showSpecialFields && (
              <>
                <FormField
                  control={form.control}
                  name="nameColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Palette size={18} className="mr-2" /> Custom Name Color
                      </FormLabel>
                      <FormControl>
                        <Input type="color" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Sparkles size={18} className="mr-2" /> Custom Title
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your title (e.g., Pro User)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <Button type="submit" className="w-full">
              Join / Log In
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
