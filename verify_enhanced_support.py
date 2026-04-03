#!/usr/bin/env python3
"""
Verify Enhanced Java Exercises and Coding Challenges Support
Tests that the mapping fix and new data work correctly.

Implementation includes:
1. Topic mapping: Fixed convert_topic_ids_to_main_topics() to handle Enhanced IDs
2. Quiz data: Seeded 40 Enhanced Java questions (5 per topic)
3. Practical hints: Added Enhanced topic hints for coding challenges
4. Dynamic generation: Existing auto-generation logic works for Enhanced topics too
"""

import json
from typing import List
from core.topic_mapping import (
    SUBTOPIC_TO_MAIN_TOPIC, 
    ENHANCED_SUBTOPIC_TO_MAIN_TOPIC,
    convert_topic_ids_to_main_topics,
    to_main_topic,
    to_main_topics
)

try:
    from database import SessionLocal
    from db_models import QuizQuestion as QuizQuestionModel
    from routers.practical_tests import TOPIC_HINTS
except Exception as e:
    print(f"❌ Import error: {e}")
    exit(1)


def test_topic_mapping():
    """Test that the mapping correctly handles both Basic and Enhanced topic IDs."""
    print("\n" + "="*80)
    print("TEST 1: Topic ID Mapping")
    print("="*80)
    
    tests = [
        # (input, expected_output, description)
        (["python_syntax"], ["Bridging from Python"], "Basic: Python syntax"),
        (["array_basics", "string_methods"], ["Array", "String"], "Basic: Multiple topics"),
        (["adv_abstract"], ["Advanced OOP"], "Enhanced: Abstract classes"),
        (["col_list", "col_map"], ["Collections Framework"], "Enhanced: Collections"),
        (["stream_basics", "stream_lambda"], ["Streams & Functional"], "Enhanced: Streams"),
        (["thread_basics", "thread_sync"], ["Concurrency"], "Enhanced: Concurrency"),
        (["algo_sorting"], ["Algorithms"], "Enhanced: Algorithms"),
        (["python_syntax", "adv_abstract"], ["Bridging from Python", "Advanced OOP"], "Mixed: Basic + Enhanced"),
    ]
    
    all_pass = True
    for topic_ids, expected, desc in tests:
        result = set(convert_topic_ids_to_main_topics(topic_ids))
        expected_set = set(expected)
        passed = result == expected_set
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} | {desc}")
        if not passed:
            print(f"       Input: {topic_ids}")
            print(f"       Expected: {expected}")
            print(f"       Got: {list(result)}")
    
    return all_pass


def test_single_topic_mapping():
    """Test single topic ID mapping (to_main_topic and to_main_topics)."""
    print("\n" + "="*80)
    print("TEST 2: Single Topic ID Mapping")
    print("="*80)
    
    tests = [
        ("python_syntax", "Bridging from Python", "Single Basic topic"),
        ("adv_abstract", "Advanced OOP", "Single Enhanced topic"),
        ("unknown_topic", "unknown_topic", "Unknown topic (fallback)"),
    ]
    
    all_pass = True
    for topic_id, expected, desc in tests:
        result = to_main_topic(topic_id)
        passed = result == expected
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} | {desc}: {topic_id} → {result}")
        if not passed:
            print(f"       Expected: {expected}")
    
    # Test to_main_topics
    topics_test = ["python_syntax", "adv_abstract"]
    topics_result = set(to_main_topics(topics_test))
    topics_expected = {"Bridging from Python", "Advanced OOP"}
    topics_pass = topics_result == topics_expected
    all_pass = all_pass and topics_pass
    status = "✓ PASS" if topics_pass else "✗ FAIL"
    print(f"{status} | to_main_topics({topics_test}) = {list(topics_result)}")
    
    return all_pass


def test_enhanced_quiz_questions():
    """Test that Enhanced quiz questions exist in the database."""
    print("\n" + "="*80)
    print("TEST 3: Enhanced Quiz Questions in Database")
    print("="*80)
    
    db = SessionLocal()
    all_pass = True
    
    enhanced_topics = {
        "Advanced OOP",
        "Collections Framework",
        "Streams & Functional",
        "Exception & I/O",
        "Concurrency",
        "Data Structures",
        "Algorithms",
        "Advanced Patterns",
    }
    
    for topic in enhanced_topics:
        count = db.query(QuizQuestionModel).filter(
            QuizQuestionModel.topic_id == topic
        ).count()
        passed = count > 0
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} | {topic}: {count} question(s)")
        
        if passed and count > 0:
            sample = db.query(QuizQuestionModel).filter(
                QuizQuestionModel.topic_id == topic
            ).first()
            if sample:
                print(f"       Sample Q: {sample.question[:60]}...")
    
    db.close()
    return all_pass


def test_enhanced_practical_test_hints():
    """Test that Enhanced topic hints exist."""
    print("\n" + "="*80)
    print("TEST 4: Enhanced Practical Test Hints")
    print("="*80)
    
    enhanced_topics = {
        "Advanced OOP",
        "Collections Framework",
        "Streams & Functional",
        "Exception & I/O",
        "Concurrency",
        "Data Structures",
        "Algorithms",
        "Advanced Patterns",
    }
    
    basic_topics = {
        "Polymorphism",
        "Inheritance",
        "Interface & Lambda",
        "Class Basics",
        "Access Modifier/Static",
        "Recursion & Revision",
        "Exception Handling & File IO",
    }
    
    all_pass = True
    
    # Check Enhanced topics have hints
    for topic in enhanced_topics:
        has_hint = topic in TOPIC_HINTS
        all_pass = all_pass and has_hint
        status = "✓ PASS" if has_hint else "✗ FAIL"
        print(f"{status} | Enhanced: {topic}")
        if has_hint:
            hint_preview = TOPIC_HINTS[topic][:70] + "..."
            print(f"       Hint: {hint_preview}")
    
    # Check Basic topics still have hints
    for topic in basic_topics:
        has_hint = topic in TOPIC_HINTS
        all_pass = all_pass and has_hint
        status = "✓ PASS" if has_hint else "✗ FAIL"
        print(f"{status} | Basic: {topic}")
    
    return all_pass


def test_backward_compatibility():
    """Ensure Basic Java path still works."""
    print("\n" + "="*80)
    print("TEST 5: Backward Compatibility (Basic Java Path)")
    print("="*80)
    
    db = SessionLocal()
    all_pass = True
    
    basic_topics = {
        "Bridging from Python",
        "Problem Solving with Java",
        "String",
        "Array",
        "Methods",
        "Exception Handling and File IO",
        "Class - constructor/attributes/methods",
        "Class - access modifier/static",
        "Inheritance",
        "Polymorphism",
        "Interface and Lambda expression",
        "Recursion and Revision",
    }
    
    for topic in basic_topics:
        count = db.query(QuizQuestionModel).filter(
            QuizQuestionModel.topic_id == topic
        ).count()
        passed = count > 0
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} | {topic}: {count} question(s)")
    
    db.close()
    return all_pass


def main():
    print("\n" + "█"*80)
    print("█ ENHANCED JAVA SUPPORT VERIFICATION")
    print("█"*80)
    print("\nRunning 5 comprehensive tests...")
    
    results = {
        "Topic Mapping": test_topic_mapping(),
        "Single Mapping": test_single_topic_mapping(),
        "Quiz Questions": test_enhanced_quiz_questions(),
        "Practical Hints": test_enhanced_practical_test_hints(),
        "Backward Compat": test_backward_compatibility(),
    }
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    all_pass = True
    for test_name, passed in results.items():
        all_pass = all_pass and passed
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status} | {test_name}")
    
    print("\n" + "█"*80)
    if all_pass:
        print("█ ✅ ALL TESTS PASSED - ENHANCED JAVA SUPPORT IS READY!")
        print("█"*80)
        print("\nNext Steps:")
        print("1. Start the backend: uvicorn main:app --reload")
        print("2. Start the frontend: cd frontend && npm start")
        print("3. Create an Enhanced Java user or switch to Enhanced path")
        print("4. Complete 2-3 Enhanced topics on the roadmap")
        print("5. Go to Exercises → select Enhanced topics → click 'Generate Quiz'")
        print("6. You should now see Enhanced Java quiz questions!")
        return 0
    else:
        print("█ ❌ SOME TESTS FAILED - Review output above")
        print("█"*80)
        return 1


if __name__ == "__main__":
    exit(main())
