--
-- PostgreSQL database dump
--

\restrict 8zssaTwljkioAY7yPdbE3tbsMI8nB802R46c1XWN3rTSkpnSVnlpHr3t826hLDK

-- Dumped from database version 16.12
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: azure_pg_admin
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO azure_pg_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversation_history; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.conversation_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    conversation_id character varying(255) NOT NULL,
    turn_number integer NOT NULL,
    is_summarized boolean DEFAULT false,
    user_message text NOT NULL,
    assistant_response text NOT NULL,
    context_type character varying(50) DEFAULT 'general'::character varying NOT NULL,
    code_snippet text,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    summary_of_turns jsonb
);


ALTER TABLE public.conversation_history OWNER TO "fypAdmin";

--
-- Name: conversation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.conversation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_history_id_seq OWNER TO "fypAdmin";

--
-- Name: conversation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.conversation_history_id_seq OWNED BY public.conversation_history.id;


--
-- Name: conversation_summaries; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.conversation_summaries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    conversation_id character varying(255) NOT NULL,
    turn_range_start integer NOT NULL,
    turn_range_end integer NOT NULL,
    num_original_turns integer NOT NULL,
    summary text NOT NULL,
    key_points jsonb,
    original_input_tokens integer DEFAULT 0,
    original_output_tokens integer DEFAULT 0,
    summary_input_tokens integer DEFAULT 0,
    summary_output_tokens integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversation_summaries OWNER TO "fypAdmin";

--
-- Name: conversation_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.conversation_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_summaries_id_seq OWNER TO "fypAdmin";

--
-- Name: conversation_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.conversation_summaries_id_seq OWNED BY public.conversation_summaries.id;


--
-- Name: practical_test_questions; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.practical_test_questions (
    id character varying(255) NOT NULL,
    topic_id character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    note text,
    methods json NOT NULL,
    expected_output json NOT NULL,
    base_class character varying(255) NOT NULL,
    base_methods json NOT NULL,
    base_helper_classes text,
    solution_methods json NOT NULL,
    solution_helper_classes text,
    created_at timestamp without time zone
);


ALTER TABLE public.practical_test_questions OWNER TO "fypAdmin";

--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.quiz_attempts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    quiz_id character varying(255) NOT NULL,
    score double precision NOT NULL,
    answers json,
    created_at timestamp without time zone
);


ALTER TABLE public.quiz_attempts OWNER TO "fypAdmin";

--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.quiz_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quiz_attempts_id_seq OWNER TO "fypAdmin";

--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.quiz_attempts_id_seq OWNED BY public.quiz_attempts.id;


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.quiz_questions (
    id character varying(255) NOT NULL,
    topic_id character varying(255) NOT NULL,
    question text NOT NULL,
    options json NOT NULL,
    correct_index integer NOT NULL,
    explanation text NOT NULL,
    created_at timestamp without time zone
);


ALTER TABLE public.quiz_questions OWNER TO "fypAdmin";

--
-- Name: test_attempts; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.test_attempts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    test_id character varying(255) NOT NULL,
    score double precision NOT NULL,
    passed boolean,
    feedback json,
    created_at timestamp without time zone
);


ALTER TABLE public.test_attempts OWNER TO "fypAdmin";

--
-- Name: test_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.test_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.test_attempts_id_seq OWNER TO "fypAdmin";

--
-- Name: test_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.test_attempts_id_seq OWNED BY public.test_attempts.id;


--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.user_progress (
    id integer NOT NULL,
    user_id integer NOT NULL,
    completed_topics json,
    quizzes_attempted integer,
    quizzes_completed json,
    tests_attempted integer,
    tests_passed json,
    playground_executions integer,
    playground_completed boolean,
    ai_interactions integer,
    completion_percentage double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    last_synced timestamp without time zone
);


ALTER TABLE public.user_progress OWNER TO "fypAdmin";

--
-- Name: user_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.user_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_progress_id_seq OWNER TO "fypAdmin";

--
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: fypAdmin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    is_active boolean
);


ALTER TABLE public.users OWNER TO "fypAdmin";

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: fypAdmin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO "fypAdmin";

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fypAdmin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: conversation_history id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_history ALTER COLUMN id SET DEFAULT nextval('public.conversation_history_id_seq'::regclass);


--
-- Name: conversation_summaries id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_summaries ALTER COLUMN id SET DEFAULT nextval('public.conversation_summaries_id_seq'::regclass);


--
-- Name: quiz_attempts id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.quiz_attempts ALTER COLUMN id SET DEFAULT nextval('public.quiz_attempts_id_seq'::regclass);


--
-- Name: test_attempts id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.test_attempts ALTER COLUMN id SET DEFAULT nextval('public.test_attempts_id_seq'::regclass);


--
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: conversation_history; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.conversation_history (id, user_id, conversation_id, turn_number, is_summarized, user_message, assistant_response, context_type, code_snippet, input_tokens, output_tokens, created_at, summary_of_turns) FROM stdin;
1	1	conv_1773710197982_cnk8hz	1	f	what is the different between for loop and while loop\n	A for loop is “definite”, which means we know, at the beginning of the loop, how many times it will repeat. A while loop is “indefinite”, which means we don’t know how many times it will repeat. The for loop is often easier to read because it puts all the loop-related statements at the top of the loop. There is another difference between for loops and while loops: if you declare a variable in the initializer, it exists only inside the for loop. For example:  \nfor (int n = 3; n > 0; n--) {  \nSystem.out.println(n);  \n}  \nSystem.out.println("n is now " + n); // compiler error	general	\N	0	0	2026-03-17 03:02:21.921773	\N
\.


--
-- Data for Name: conversation_summaries; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.conversation_summaries (id, user_id, conversation_id, turn_range_start, turn_range_end, num_original_turns, summary, key_points, original_input_tokens, original_output_tokens, summary_input_tokens, summary_output_tokens, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: practical_test_questions; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.practical_test_questions (id, topic_id, title, description, note, methods, expected_output, base_class, base_methods, base_helper_classes, solution_methods, solution_helper_classes, created_at) FROM stdin;
pt_1773066839_6028	OOP Basics	Bank Account Operations	Create a simple BankAccount class with methods to deposit, withdraw, and get the current balance. Ensure that withdrawals do not exceed the available balance.		[{"name": "deposit", "description": "Adds the specified amount to the account balance."}, {"name": "withdraw", "description": "Subtracts the specified amount from the balance if sufficient funds are available; otherwise, does nothing."}, {"name": "getBalance", "description": "Returns the current account balance."}]	["150.0", "50.0", "50.0"]	Solution	{"deposit": "public void deposit(double amount) {}", "withdraw": "public void withdraw(double amount) {}", "getBalance": "public double getBalance() { return 0.0; }"}	\N	{"deposit": ["public void deposit(double amount) {", "    if (amount > 0) {", "        balance += amount;", "    }", "}"], "withdraw": ["public void withdraw(double amount) {", "    if (amount > 0 && amount <= balance) {", "        balance -= amount;", "    }", "}"], "getBalance": ["public double getBalance() {", "    return balance;", "}"], "runApp": ["public void runApp() {", "    Solution account = new Solution();", "    account.deposit(100.0);", "    account.deposit(50.0);", "    System.out.println(account.getBalance());", "    account.withdraw(100.0);", "    System.out.println(account.getBalance());", "    account.withdraw(200.0); // should not affect balance", "    System.out.println(account.getBalance());", "}", "private double balance = 0.0;"]}	\N	\N
pt_1773066842_9861	OOP Basics	Bank Account Operations	Create a simple BankAccount class with methods to deposit, withdraw, and get the current balance. Ensure that withdrawals cannot exceed the available balance.	Use a private instance variable to store the balance.	[{"name": "deposit", "description": "Adds the specified amount to the account balance. Amount must be positive."}, {"name": "withdraw", "description": "Subtracts the specified amount from the balance if sufficient funds are available. Returns true if successful, false otherwise."}, {"name": "getBalance", "description": "Returns the current account balance."}]	["150.0", "true", "50.0", "false", "50.0"]	Solution	{"deposit": "public void deposit(double amount) {}", "withdraw": "public boolean withdraw(double amount) {}", "getBalance": "public double getBalance() {}"}	\N	{"deposit": ["if (amount > 0) {", "    this.balance += amount;", "}"], "withdraw": ["if (amount > 0 && amount <= this.balance) {", "    this.balance -= amount;", "    return true;", "}", "return false;"], "getBalance": ["return this.balance;"], "runApp": ["Solution account = new Solution();", "account.deposit(100.0);", "account.deposit(50.0);", "System.out.println(account.getBalance());", "System.out.println(account.withdraw(100.0));", "System.out.println(account.getBalance());", "System.out.println(account.withdraw(60.0));", "System.out.println(account.getBalance());"]}	\N	\N
pt_1773066847_3839	OOP Basics	Implement a Simple Bank Account	Create a BankAccount class with methods to deposit, withdraw, and get the current balance. The initial balance is zero. Withdrawals should not allow the balance to go below zero.		[{"name": "deposit", "description": "Adds the specified amount to the balance. Amount must be positive."}, {"name": "withdraw", "description": "Subtracts the specified amount from the balance if sufficient funds exist. Returns true if successful, false otherwise."}, {"name": "getBalance", "description": "Returns the current balance."}]	["150.0", "true", "50.0", "false", "50.0"]	Solution	{"deposit": "public void deposit(double amount) {}", "withdraw": "public boolean withdraw(double amount) {}", "getBalance": "public double getBalance() { return 0.0; }"}	\N	{"deposit": ["if (amount > 0) {", "    balance += amount;", "}"], "withdraw": ["if (amount > 0 && balance >= amount) {", "    balance -= amount;", "    return true;", "}", "return false;"], "getBalance": ["return balance;"], "runApp": ["Solution account = new Solution();", "account.deposit(100);", "account.deposit(50);", "System.out.println(account.getBalance());", "System.out.println(account.withdraw(100));", "System.out.println(account.getBalance());", "System.out.println(account.withdraw(100));", "System.out.println(account.getBalance());"]}	\N	\N
pt_1773066856_1025	Arrays	Array Sum and Average	Implement methods to calculate the sum and average of integer array elements. Also, find the count of even numbers in the array.		[{"name": "arraySum", "description": "Returns the sum of all elements in the given integer array."}, {"name": "arrayAverage", "description": "Returns the average of all elements in the given integer array as a double."}, {"name": "countEvenNumbers", "description": "Returns the number of even integers in the given array."}]	["Sum: 15", "Average: 3.0", "Even count: 2"]	Solution	{"arraySum": "public int arraySum(int[] arr) {}", "arrayAverage": "public double arrayAverage(int[] arr) {}", "countEvenNumbers": "public int countEvenNumbers(int[] arr) {}"}	\N	{"arraySum": ["public int arraySum(int[] arr) {", "    int sum = 0;", "    for (int num : arr) {", "        sum += num;", "    }", "    return sum;", "}"], "arrayAverage": ["public double arrayAverage(int[] arr) {", "    if (arr.length == 0) return 0.0;", "    return (double) arraySum(arr) / arr.length;", "}"], "countEvenNumbers": ["public int countEvenNumbers(int[] arr) {", "    int count = 0;", "    for (int num : arr) {", "        if (num % 2 == 0) {", "            count++;", "        }", "    }", "    return count;", "}"], "runApp": ["public void runApp() {", "    int[] testArray = {1, 2, 3, 4, 5};", "    System.out.println(\\"Sum: \\" + arraySum(testArray));", "    System.out.println(\\"Average: \\" + arrayAverage(testArray));", "    System.out.println(\\"Even count: \\" + countEvenNumbers(testArray));", "}"]}	\N	\N
pt_1773067126_8667	Interface & Lambda	String Processor with Lambda	Implement methods that use a functional interface to process strings. Define a StringProcessor interface with a process method, then implement methods that apply different transformations using lambda expressions.	Use Java's functional interface capabilities and lambda syntax.	[{"name": "toUpperCase", "description": "Returns a StringProcessor lambda that converts input string to uppercase."}, {"name": "reverseString", "description": "Returns a StringProcessor lambda that reverses the input string."}, {"name": "applyProcessor", "description": "Applies the given StringProcessor to the input string and returns the result."}]	["HELLO", "olleh"]	Solution	{"toUpperCase": "public StringProcessor toUpperCase() {}", "reverseString": "public StringProcessor reverseString() {}", "applyProcessor": "public String applyProcessor(StringProcessor processor, String input) {}"}	\N	{"toUpperCase": ["return s -> s.toUpperCase();"], "reverseString": ["return s -> new StringBuilder(s).reverse().toString();"], "applyProcessor": ["return processor.process(input);"], "runApp": ["String input = \\"hello\\";", "StringProcessor upper = toUpperCase();", "StringProcessor reversed = reverseString();", "System.out.println(applyProcessor(upper, input));", "System.out.println(applyProcessor(reversed, input));"]}	\N	\N
pt_1773295689_7391	Problem Solving with Java	Count Even Numbers	Write a method that counts how many even numbers are in an integer array.		[{"name": "countEvenNumbers", "description": "Return the number of even integers in the given array."}]	["4", "0"]	Solution	{"countEvenNumbers": "public int countEvenNumbers(int[] numbers) {}"}	\N	{"countEvenNumbers": ["int count = 0;", "for (int num : numbers) {", "    if (num % 2 == 0) {", "        count++;", "    }", "}", "return count;"], "runApp": ["int[] arr1 = {2, 4, 1, 6, 8, 3};", "int[] arr2 = {1, 3, 5};", "System.out.println(countEvenNumbers(arr1));", "System.out.println(countEvenNumbers(arr2));"]}	\N	\N
pt_1773295729_6336	Bridging from Python	String Reverser	Write a method that reverses a given string. Then write a method that prints each character of the reversed string on a new line.		[{"name": "reverseString", "description": "Return a new string with characters in reverse order."}, {"name": "printReversedChars", "description": "Print each character of the reversed input string on its own line."}]	["o", "l", "l", "e", "h"]	Solution	{"reverseString": "public String reverseString(String input) {}", "printReversedChars": "public void printReversedChars(String input) {}"}	\N	{"reverseString": ["StringBuilder sb = new StringBuilder(input);", "return sb.reverse().toString();"], "printReversedChars": ["String reversed = reverseString(input);", "for (int i = 0; i < reversed.length(); i++) {", "    System.out.println(reversed.charAt(i));", "}"], "runApp": ["Solution sol = new Solution();", "sol.printReversedChars(\\"hello\\");"]}	\N	\N
pt_1773295949_5155	Polymorphism	Animal Sounds	Create classes for animals that make different sounds using polymorphism.		[{"name": "getSound", "description": "Return the sound the animal makes."}]	["Woof!", "Meow!", "Quack!"]	Solution	{"getSound": "public String getSound(String animal) { return \\"\\"; }"}	\N	{"getSound": ["if (animal.equals(\\"Dog\\")) {", "    return \\"Woof!\\";", "} else if (animal.equals(\\"Cat\\")) {", "    return \\"Meow!\\";", "} else if (animal.equals(\\"Duck\\")) {", "    return \\"Quack!\\";", "}", "return \\"\\";"], "runApp": ["System.out.println(getSound(\\"Dog\\"));", "System.out.println(getSound(\\"Cat\\"));", "System.out.println(getSound(\\"Duck\\"));"]}	\N	\N
pt_1773297463_6580	Inheritance	Animal Sounds	Create a simple class hierarchy with Animal and Dog. Implement a method that returns the sound each animal makes.		[{"name": "getAnimalSound", "description": "Return the sound of a Dog instance using inheritance from Animal."}]	["Animal makes a sound", "Dog barks"]	Solution	{"getAnimalSound": "public String[] getAnimalSound() { return null; }"}	class Animal {\n    public String makeSound() {\n        return "Animal makes a sound";\n    }\n}\n\nclass Dog extends Animal {\n    @Override\n    public String makeSound() {\n        return "Dog barks";\n    }\n}	{"getAnimalSound": ["Animal animal = new Animal();", "Dog dog = new Dog();", "return new String[]{animal.makeSound(), dog.makeSound()};"], "runApp": ["String[] sounds = getAnimalSound();", "for (String sound : sounds) {", "    System.out.println(sound);", "}"]}	class Animal {\n    public String makeSound() {\n        return "Animal makes a sound";\n    }\n}\n\nclass Dog extends Animal {\n    @Override\n    public String makeSound() {\n        return "Dog barks";\n    }\n}	\N
\.


--
-- Data for Name: quiz_attempts; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.quiz_attempts (id, user_id, quiz_id, score, answers, created_at) FROM stdin;
\.


--
-- Data for Name: quiz_questions; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.quiz_questions (id, topic_id, question, options, correct_index, explanation, created_at) FROM stdin;
q1772785971_1	Bridging from Python	In Java, how do you make the Scanner class available for use in your program?	["By writing 'include java.util.Scanner;' at the top of your file", "By writing 'import java.util.Scanner;' at the top of your file", "By declaring 'Scanner' as a built-in keyword in your main method", "By copying the Scanner source code into your program"]	1	The correct way to use the Scanner class is by importing it using the 'import' keyword followed by its fully qualified name: 'import java.util.Scanner;'. This matches the syntax described in the study material.	2026-03-06 08:33:02.197475
q1772785971_2	Bridging from Python	What does the statement 'import java.util.*;' accomplish in a Java program?	["It imports only the Scanner class from the java.util package", "It imports all classes from the java.util package", "It defines a new package named java.util", "It compiles all files in the java.util directory"]	1	Using 'import java.util.*;' imports all classes in the java.util package, as indicated by the wildcard (*) syntax in the provided material.	2026-03-06 08:33:02.197483
q1772785971_3	Bridging from Python	After importing the Scanner class, what must you do before using its methods to read user input?	["Call Scanner.read() directly without any setup", "Use the 'new' keyword to create an instance (object) of the Scanner class", "Declare a variable named 'input' of type String", "Link to a Python input() function for compatibility"]	1	As stated in the material, to use the Scanner class, you must first create an object of the class. This is done using the 'new' keyword, which instantiates the class so its methods can be called.	2026-03-06 08:33:02.197484
q1772786125_1	Bridging from Python	In Java, which statement correctly imports only the Scanner class from the java.util package?	["import java.util;", "import java.util.Scanner;", "import Scanner from java.util;", "using java.util.Scanner;"]	1	The correct syntax to import a single class in Java is 'import package.name.Class;'. Thus, 'import java.util.Scanner;' is the proper way to import only the Scanner class.	2026-03-06 08:35:52.239237
q1772786125_2	Array	Which of the following correctly declares and initializes an array of integers with the values 10, 20, 30, and 40?	["int myNum[] = [10, 20, 30, 40];", "int[] myNum = (10, 20, 30, 40);", "int[] myNum = {10, 20, 30, 40};", "array<int> myNum = {10, 20, 30, 40};"]	2	In Java, arrays are initialized using curly braces {} with comma-separated values. The correct declaration is 'int[] myNum = {10, 20, 30, 40};'.	2026-03-06 08:35:52.239243
q1772786125_3	Bridging from Python	Why is the 'import' statement necessary when using classes like Scanner in Java?	["It compiles the class into your program.", "It makes the class available for use without writing its fully qualified name each time.", "It automatically creates an instance of the class.", "It links external libraries written in Python."]	1	The 'import' statement allows you to use a class (like Scanner) by its simple name instead of its fully qualified name (e.g., java.util.Scanner), improving code readability and convenience.	2026-03-06 08:35:52.239245
q1772786125_4	Array	What is the correct syntax to declare an array of strings named 'colors' in Java?	["String colors[];", "string[] colors;", "Array<String> colors;", "String[] colors();"]	0	In Java, arrays can be declared with brackets after the type ('String[] colors;') or after the variable name ('String colors[];'). Both are valid, but the provided material uses the latter form, making option A correct per the given examples.	2026-03-06 08:35:52.239247
q1772786125_5	Array	Given the array declaration 'String[] cars = {"Volvo", "BMW", "Ford", "Mazda"};', how would you access the second element ("BMW")?	["cars[1]", "cars(2)", "cars[2]", "cars.get(1)"]	0	Java arrays are zero-indexed, so the first element is at index 0. Therefore, the second element ("BMW") is accessed using 'cars[1]'.	2026-03-06 08:35:52.239248
q1772786184_1	Bridging from Python	In Java, what is the primary purpose of the 'import' statement when using a class like Scanner?	["To compile the Scanner class into your program", "To make the class accessible without using its fully qualified name", "To define a new instance of the Scanner class", "To link external libraries during runtime"]	1	The 'import' statement allows you to refer to a class (like Scanner) by its simple name instead of its fully qualified name (e.g., java.util.Scanner), improving code readability and convenience.	2026-03-06 08:37:14.970468
q1772786184_2	Bridging from Python	Which of the following correctly demonstrates how to import all classes from the java.util package?	["import java.util;", "import java.util.*;", "import * from java.util;", "include java.util.*;"]	1	In Java, 'import java.util.*;' imports all public classes from the java.util package, allowing them to be used without their full package prefix.	2026-03-06 08:37:14.970476
q1772786184_3	Bridging from Python	After importing the Scanner class, what must you do before calling methods like nextInt() or nextLine()?	["Call the static method Scanner.initialize()", "Declare a variable of type Scanner and instantiate it with 'new Scanner(...)'", "Use the Scanner class directly without creating an object", "Link the standard input stream using System.in.connect()"]	1	Scanner is not a static utility class; you must create an instance (object) of it, typically passing System.in as the input source, before invoking its methods.	2026-03-06 08:37:14.970478
q1772786184_4	Bridging from Python	What would happen if you tried to use the Scanner class in Java without importing it or using its fully qualified name?	["The program would compile but throw a runtime exception", "The compiler would generate an error about an unknown symbol", "Java would automatically import commonly used classes like Scanner", "The Scanner would default to reading from a file instead of standard input"]	1	Without an import statement or the fully qualified class name (java.util.Scanner), the Java compiler does not recognize 'Scanner' as a valid type, resulting in a compilation error.	2026-03-06 08:37:14.97048
q1772786184_5	Bridging from Python	Why might a Java programmer choose to import only 'java.util.Scanner' instead of 'java.util.*'?	["It reduces the compiled file size significantly", "It avoids potential naming conflicts with other classes in the same package", "It makes the Scanner class run faster", "It is required by the Java language specification for I/O operations"]	1	Importing specific classes rather than entire packages helps prevent naming ambiguities if multiple packages contain classes with the same name, enhancing code clarity and maintainability.	2026-03-06 08:37:14.970481
q1772786184_6	Bridging from Python	In the statement 'import java.util.Scanner;', what does 'java.util' represent?	["A built-in Java function", "The name of the Scanner class\\u2019s superclass", "A package containing the Scanner class", "A module that handles user input"]	2	'java.util' is a standard Java package that groups related utility classes, including Scanner, ArrayList, and others.	2026-03-06 08:37:14.970483
q1772786184_7	Bridging from Python	Which of the following is true about Java’s import mechanism compared to typical Python module usage?	["Java imports execute code at runtime like Python\\u2019s 'import'", "Java imports are purely compile-time directives and do not affect runtime behavior", "Java requires explicit linking of imported classes at runtime", "Java imports automatically instantiate objects from the imported classes"]	1	Java import statements are resolved at compile time to simplify class name resolution; they do not load code or execute anything at runtime, unlike Python’s dynamic import system.	2026-03-06 08:37:14.970485
q1772786184_8	Bridging from Python	What is the correct way to create a Scanner object that reads from standard input in Java?	["Scanner input = new Scanner();", "Scanner input = Scanner(System.in);", "Scanner input = new Scanner(System.in);", "Scanner input = create Scanner(System.in);"]	2	The Scanner constructor requires a source (like System.in for standard input), and objects in Java are created using the 'new' keyword.	2026-03-06 08:37:14.970486
q1772786184_9	Bridging from Python	If two different packages each contain a class named 'Logger', how can you use both in the same Java file without ambiguity?	["Use wildcard imports for both packages and rely on Java\\u2019s auto-resolution", "Import one class and use the fully qualified name for the other", "Java does not allow this situation; compilation will fail", "Rename one of the classes in your source code"]	1	To avoid naming conflicts, you can import one class normally and refer to the other using its full package-qualified name (e.g., com.example.Logger).	2026-03-06 08:37:14.970488
q1772786184_10	Bridging from Python	Which statement best describes the relationship between packages and imports in Java?	["Packages are imported to add functionality that isn\\u2019t part of the Java standard library", "Imports are used to include source code from other files into your program", "Packages organize classes into namespaces, and imports provide shorthand access to those classes", "Every Java class must belong to a package that is explicitly imported in every file"]	2	Packages in Java serve as namespaces to avoid naming collisions, and import statements let you use classes from those packages without typing their full names repeatedly.	2026-03-06 08:37:14.97049
q1773125667_1	Problem Solving with Java	What is one key purpose of the debugging exercise described in the material?	["To memorize Java syntax by repetition", "To practice recognizing a specific problem as an instance of a general category of problems", "To learn how to create user accounts on W3Schools", "To avoid using conditionals in Java programs"]	1	The material explicitly states that one purpose of the exercise is to practice pattern-matching: the ability to recognize a specific problem as an instance of a general category of problems.	2026-03-10 06:55:12.796643
q1773125667_2	Conditionals and Logic	Why are conditionals important in Java programs according to the material?	["They allow programs to generate the same output regardless of input", "They simplify the process of creating a W3Schools account", "They enable programs to react to inputs and check for certain conditions", "They replace the need for methods entirely"]	2	The material explains that conditionals allow programs to react to inputs, check for conditions, and generate applicable results, unlike simpler programs that do the same thing every time.	2026-03-10 06:55:12.796647
q1773125667_3	Problem Solving with Java	According to the study material, what makes debugging two methods at the same time challenging?	["It requires creating a W3Schools account", "It involves pattern-matching across multiple tutorials", "It can be difficult to isolate issues when multiple methods interact", "Java does not support debugging more than one method"]	2	The material notes that debugging two methods simultaneously can be difficult, implying complexity in isolating and resolving issues when multiple components interact.	2026-03-10 06:55:12.796647
q1773125667_4	Conditionals and Logic	What distinguishes programs in Chapter 5 from those in earlier chapters, based on the material?	["They always produce random output", "They no longer accept any user input", "They perform the same actions regardless of input", "They respond differently based on input and conditions"]	3	Chapter 5 introduces logic and conditionals, enabling programs to react to inputs and generate results based on specific conditions, unlike earlier deterministic programs.	2026-03-10 06:55:12.796648
q1773125667_5	Problem Solving with Java	What learning approach is emphasized in the 'Learn by Examples' section?	["Rote memorization of Java keywords", "Supplementing explanations with clarifying examples", "Skipping theory to focus only on quizzes", "Avoiding debugging to reduce complexity"]	1	The material states that the tutorial supplements all explanations with clarifying examples, highlighting example-based learning.	2026-03-10 06:55:12.796648
q1773125667_6	Conditionals and Logic	Which Java language feature is introduced in Chapter 5 to handle varying program behavior?	["Object instantiation", "Loop unrolling", "Conditional statements and logic expressions", "Method overloading"]	2	Chapter 5 specifically introduces Java features for expressing logic, which include conditionals that allow programs to behave differently based on inputs.	2026-03-10 06:55:12.796649
q1773125667_7	Problem Solving with Java	What skill is being developed when you recognize a specific coding problem as part of a broader problem category?	["Syntax highlighting", "Pattern-matching", "Account creation", "Website deployment"]	1	The material defines this skill explicitly as 'pattern-matching': the ability to recognize a specific problem as an instance of a general category.	2026-03-10 06:55:12.796649
q1773125667_8	Conditionals and Logic	Based on the material, what is a primary reason to use conditionals in a Java program?	["To ensure the program runs identically every time", "To eliminate the need for methods", "To make the program generate applicable results based on checked conditions", "To simplify account registration on educational platforms"]	2	The text states that conditionals help programs check for certain conditions and generate applicable results, making behavior dynamic and input-responsive.	2026-03-10 06:55:12.79665
q1773125667_9	Problem Solving with Java	According to the material, what is an optional feature when studying at W3Schools?	["Accessing Java examples", "Reading chapter explanations", "Creating a W3Schools account", "Learning by examples"]	2	The note explicitly says that creating a W3Schools account is optional and that users can study without one.	2026-03-10 06:55:12.79665
q1773125667_10	Conditionals and Logic	What limitation do programs in chapters before Chapter 5 have, according to the material?	["They cannot use methods", "They do the same thing every time they run, regardless of input", "They require user accounts to execute", "They lack any form of output"]	1	The material states that prior programs 'do the same thing every time they are run, regardless of the input,' which conditionals in Chapter 5 aim to address.	2026-03-10 06:55:12.79665
\.


--
-- Data for Name: test_attempts; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.test_attempts (id, user_id, test_id, score, passed, feedback, created_at) FROM stdin;
\.


--
-- Data for Name: user_progress; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.user_progress (id, user_id, completed_topics, quizzes_attempted, quizzes_completed, tests_attempted, tests_passed, playground_executions, playground_completed, ai_interactions, completion_percentage, created_at, updated_at, last_synced) FROM stdin;
1	1	["python_types", "ps_algorithm", "ps_pseudocode", "ps_debugging", "python_compilation", "python_syntax", "ps_optimization", "python_structure"]	5	["quiz_1773709310037", "quiz_1773125746890", "quiz_1773126029531", "quiz_1773720044084", "quiz_1773125552782"]	1	["test_pt_1773297463_6580_1773299123702"]	37	t	10	0	2026-03-06 08:39:19.371284	2026-03-17 05:58:48.738625	2026-03-17 05:58:48.737453
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: fypAdmin
--

COPY public.users (id, email, password_hash, full_name, created_at, updated_at, is_active) FROM stdin;
1	test@test.com	$2b$12$sxbePYc0r8YdXUhH4MkGu.6zvIM6kAPor4sHC3uzpQ0SQiLFifL1a	Test User	2026-03-06 08:28:31.362342	2026-03-06 08:28:31.362348	t
\.


--
-- Name: conversation_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.conversation_history_id_seq', 1, true);


--
-- Name: conversation_summaries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.conversation_summaries_id_seq', 1, false);


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.quiz_attempts_id_seq', 1, false);


--
-- Name: test_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.test_attempts_id_seq', 1, false);


--
-- Name: user_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.user_progress_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fypAdmin
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: conversation_history conversation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_history
    ADD CONSTRAINT conversation_history_pkey PRIMARY KEY (id);


--
-- Name: conversation_summaries conversation_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_summaries
    ADD CONSTRAINT conversation_summaries_pkey PRIMARY KEY (id);


--
-- Name: practical_test_questions practical_test_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.practical_test_questions
    ADD CONSTRAINT practical_test_questions_pkey PRIMARY KEY (id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: test_attempts test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_practical_test_questions_topic_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_practical_test_questions_topic_id ON public.practical_test_questions USING btree (topic_id);


--
-- Name: ix_quiz_attempts_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_quiz_attempts_id ON public.quiz_attempts USING btree (id);


--
-- Name: ix_quiz_attempts_quiz_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_quiz_attempts_quiz_id ON public.quiz_attempts USING btree (quiz_id);


--
-- Name: ix_quiz_attempts_user_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_quiz_attempts_user_id ON public.quiz_attempts USING btree (user_id);


--
-- Name: ix_quiz_questions_topic_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_quiz_questions_topic_id ON public.quiz_questions USING btree (topic_id);


--
-- Name: ix_test_attempts_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_test_attempts_id ON public.test_attempts USING btree (id);


--
-- Name: ix_test_attempts_test_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_test_attempts_test_id ON public.test_attempts USING btree (test_id);


--
-- Name: ix_test_attempts_user_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_test_attempts_user_id ON public.test_attempts USING btree (user_id);


--
-- Name: ix_user_progress_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_user_progress_id ON public.user_progress USING btree (id);


--
-- Name: ix_user_progress_user_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_user_progress_user_id ON public.user_progress USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: conversation_history conversation_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_history
    ADD CONSTRAINT conversation_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: conversation_summaries conversation_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.conversation_summaries
    ADD CONSTRAINT conversation_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: quiz_attempts quiz_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: test_attempts test_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: FUNCTION pg_replication_origin_advance(text, pg_lsn); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_advance(text, pg_lsn) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_create(text); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_create(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_drop(text); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_drop(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_oid(text); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_oid(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_progress(text, boolean); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_progress(text, boolean) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_is_setup(); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_is_setup() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_progress(boolean); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_progress(boolean) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_reset(); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_session_setup(text); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_session_setup(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_xact_reset(); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_xact_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_replication_origin_xact_setup(pg_lsn, timestamp with time zone); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_replication_origin_xact_setup(pg_lsn, timestamp with time zone) TO azure_pg_admin;


--
-- Name: FUNCTION pg_show_replication_origin_status(OUT local_id oid, OUT external_id text, OUT remote_lsn pg_lsn, OUT local_lsn pg_lsn); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_show_replication_origin_status(OUT local_id oid, OUT external_id text, OUT remote_lsn pg_lsn, OUT local_lsn pg_lsn) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset(); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset() TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_shared(text); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_shared(text) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_single_function_counters(oid); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_single_function_counters(oid) TO azure_pg_admin;


--
-- Name: FUNCTION pg_stat_reset_single_table_counters(oid); Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT ALL ON FUNCTION pg_catalog.pg_stat_reset_single_table_counters(oid) TO azure_pg_admin;


--
-- Name: COLUMN pg_config.name; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(name) ON TABLE pg_catalog.pg_config TO azure_pg_admin;


--
-- Name: COLUMN pg_config.setting; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(setting) ON TABLE pg_catalog.pg_config TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.line_number; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(line_number) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.type; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(type) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.database; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(database) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.user_name; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(user_name) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.address; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(address) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.netmask; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(netmask) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.auth_method; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(auth_method) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.options; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(options) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_hba_file_rules.error; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(error) ON TABLE pg_catalog.pg_hba_file_rules TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.local_id; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(local_id) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.external_id; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(external_id) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.remote_lsn; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(remote_lsn) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_replication_origin_status.local_lsn; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(local_lsn) ON TABLE pg_catalog.pg_replication_origin_status TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.name; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(name) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.off; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(off) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.size; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(size) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_shmem_allocations.allocated_size; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(allocated_size) ON TABLE pg_catalog.pg_shmem_allocations TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.starelid; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(starelid) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staattnum; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staattnum) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stainherit; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stainherit) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanullfrac; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanullfrac) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stawidth; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stawidth) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stadistinct; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stadistinct) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind1; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stakind1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind2; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stakind2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind3; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stakind3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind4; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stakind4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stakind5; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stakind5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop1; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staop1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop2; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staop2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop3; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staop3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop4; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staop4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.staop5; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(staop5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll1; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stacoll1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll2; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stacoll2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll3; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stacoll3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll4; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stacoll4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stacoll5; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stacoll5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers1; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanumbers1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers2; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanumbers2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers3; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanumbers3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers4; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanumbers4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stanumbers5; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stanumbers5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues1; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stavalues1) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues2; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stavalues2) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues3; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stavalues3) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues4; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stavalues4) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_statistic.stavalues5; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(stavalues5) ON TABLE pg_catalog.pg_statistic TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.oid; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(oid) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subdbid; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subdbid) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subname; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subname) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subowner; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subowner) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subenabled; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subenabled) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subconninfo; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subconninfo) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subslotname; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subslotname) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subsynccommit; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subsynccommit) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- Name: COLUMN pg_subscription.subpublications; Type: ACL; Schema: pg_catalog; Owner: azuresu
--

GRANT SELECT(subpublications) ON TABLE pg_catalog.pg_subscription TO azure_pg_admin;


--
-- PostgreSQL database dump complete
--

\unrestrict 8zssaTwljkioAY7yPdbE3tbsMI8nB802R46c1XWN3rTSkpnSVnlpHr3t826hLDK

