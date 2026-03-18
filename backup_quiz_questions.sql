--
-- PostgreSQL database dump
--

\restrict FJkXM4HFGNdT9yJf1KGq5ZoqsVc3ybl3GodKrbbRMslpWolG5oW4dMS5u12Hm3f

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
\.


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: fypAdmin
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: ix_quiz_questions_topic_id; Type: INDEX; Schema: public; Owner: fypAdmin
--

CREATE INDEX ix_quiz_questions_topic_id ON public.quiz_questions USING btree (topic_id);


--
-- PostgreSQL database dump complete
--

\unrestrict FJkXM4HFGNdT9yJf1KGq5ZoqsVc3ybl3GodKrbbRMslpWolG5oW4dMS5u12Hm3f

