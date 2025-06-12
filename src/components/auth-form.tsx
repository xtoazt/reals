
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Palette, Sparkles, User as UserIcon, KeyRound } from 'lucide-react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { auth, database } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';

const DUMMY_EMAIL_DOMAIN = 'realtalk.users.app';

const loginSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }).max(30, { message: 'Username can be at most 30 characters.'}).regex(/^[a-zA-Z0-9_]+$/, { message: 'Login username can only contain letters, numbers, and underscores.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const signupSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters.' }).max(30, { message: 'Username can be at most 30 characters.'}).regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  specialCode: z.string().optional(),
  nameColor: z.string().optional(),
  title: z.string().optional(),
});


export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showSpecialFields, setShowSpecialFields] = React.useState(false); // For title input and possibly nameColor
  const [isShinyGoldSignup, setIsShinyGoldSignup] = React.useState(false); // For "asd" code
  const [isShinySilverSignup, setIsShinySilverSignup] = React.useState(false); // For "qwe" code
  const [isAdminSignup, setIsAdminSignup] = React.useState(false); // For "asd" code
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("login");


  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      password: '',
      specialCode: '',
      nameColor: '#FFA500', 
      title: '',
    },
  });

  const watchSpecialCode = signupForm.watch('specialCode');

  React.useEffect(() => {
    // Reset special flags first
    setShowSpecialFields(false);
    setIsShinyGoldSignup(false);
    setIsShinySilverSignup(false);
    setIsAdminSignup(false);
    signupForm.setValue('nameColor', '#FFA500'); // Reset name color default

    if (watchSpecialCode === 'asd') {
      setShowSpecialFields(true); // For title
      setIsAdminSignup(true);
      setIsShinyGoldSignup(true);
      toast({
        title: '👑 Admin & Shiny Gold Mode Activated! ✨',
        description: 'Your name and title will be shiny gold and bold!',
      });
    } else if (watchSpecialCode === 'qwe') {
      setShowSpecialFields(true); // For title
      setIsShinySilverSignup(true);
      toast({
        title: '🥈 Shiny Silver Mode Activated! 🥈',
        description: 'Your name and title will be shiny silver and bold!',
      });
    } else if (watchSpecialCode === '1234') {
      setShowSpecialFields(true); // For title & nameColor
      toast({
        title: '🎨 Special Mode Activated!',
        description: 'You can now set a custom name color and title.',
      });
    }
  }, [watchSpecialCode, toast, signupForm]);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    const lowerCaseUsername = values.username.toLowerCase();
    const emailForAuth = `${lowerCaseUsername}@${DUMMY_EMAIL_DOMAIN}`;
    try {
      await signInWithEmailAndPassword(auth, emailForAuth, values.password);
      toast({
        title: 'Logged In!',
        description: `Welcome back, ${values.username}!`, 
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = 'An unexpected error occurred during login.';
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'The username or password you entered is incorrect. Please try again.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
         errorMessage = 'The username or password you entered is incorrect. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/missing-provider-config') {
        errorMessage = 'Login method not enabled. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    setIsLoading(true);
    const lowerCaseLoginUsername = values.username.toLowerCase();
    const emailForAuth = `${lowerCaseLoginUsername}@${DUMMY_EMAIL_DOMAIN}`;
    
    const usernameNodeRef = ref(database, `usernames/${lowerCaseLoginUsername}`);
    const usernameSnapshot = await get(usernameNodeRef);
    if (usernameSnapshot.exists()) {
      toast({
        title: 'Signup Failed',
        description: 'This login username is already taken. Please choose another.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailForAuth, values.password);
      const user = userCredential.user;

      if (user) {
        await updateProfile(user, {
            displayName: values.username, 
        });

        const userProfileRef = ref(database, `users/${user.uid}`);
        const profileData: {
            uid: string;
            username: string; 
            displayName: string; 
            email: string; 
            nameColor?: string;
            title?: string;
            bio: string;
            avatar: string;
            banner?: string;
            isShinyGold?: boolean;
            isShinySilver?: boolean;
            isAdmin?: boolean;
            friendsCount: number;
        } = {
            uid: user.uid,
            username: lowerCaseLoginUsername, 
            displayName: values.username, 
            email: emailForAuth, 
            avatar: `https://placehold.co/128x128.png?text=${values.username.substring(0,2).toUpperCase()}`,
            banner: `https://placehold.co/1200x300.png?text=Hello+${values.username}`,
            bio: "New user! Ready to chat.",
            friendsCount: 0,
            isAdmin: isAdminSignup,
            isShinyGold: isShinyGoldSignup,
            isShinySilver: isShinySilverSignup,
        };

        if (showSpecialFields) {
            profileData.title = values.title || '';
            // Only set nameColor if no shiny style is active
            if (!isShinyGoldSignup && !isShinySilverSignup && watchSpecialCode === '1234') {
                 profileData.nameColor = values.nameColor || '#FFA500';
            }
        }
        
        await set(userProfileRef, profileData);
        await set(usernameNodeRef, user.uid);

        toast({
          title: 'Account Created!',
          description: `Welcome, ${values.username}!`, 
        });
        router.push('/dashboard?showThemePicker=true'); 
      } else {
        throw new Error("User creation failed post-auth.");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = 'An unexpected error occurred during signup.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This login username is already taken (the email address derived from it is in use). Please choose another.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/missing-provider-config') {
        errorMessage = 'Email/Password sign-up is not enabled. Please contact support.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = 'Firebase authentication is not configured correctly. Please check your Firebase project settings.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: 'Signup Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <Card className="w-full max-w-md shadow-2xl z-10" style={{backgroundColor: 'var(--card)', color: 'var(--card-foreground)'}}>
      <CardHeader>
        <CardTitle className="text-3xl font-headline text-center">real.</CardTitle>
        <CardDescription className="text-center">
          connect fr
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-6">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><UserIcon size={16} className="mr-2 opacity-70"/>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><KeyRound size={16} className="mr-2 opacity-70"/>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            {...field}
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Logging In...' : 'Log In'}
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="signup" className="pt-6">
             <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                <FormField
                  control={signupForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel  className="flex items-center"><UserIcon size={16} className="mr-2 opacity-70"/>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Choose your username (no spaces/periods)" {...field} disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><KeyRound size={16} className="mr-2 opacity-70"/>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Choose a strong password"
                            {...field}
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="specialCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Code (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter special code if you have one" {...field} disabled={isLoading}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showSpecialFields && !isShinyGoldSignup && !isShinySilverSignup && watchSpecialCode === '1234' && (
                  <FormField
                    control={signupForm.control}
                    name="nameColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Palette size={18} className="mr-2" /> Custom Name Color
                        </FormLabel>
                        <FormControl>
                          <Input type="color" {...field} disabled={isLoading}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {showSpecialFields && (
                  <FormField
                    control={signupForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          <Sparkles size={18} className="mr-2" /> Custom Title
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your title (e.g., Pro User)" {...field} disabled={isLoading}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing Up...' : 'Sign Up'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
