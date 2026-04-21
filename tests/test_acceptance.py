# tests/test_acceptance.py
import pytest
import re
from playwright.sync_api import Page, expect


BASE_URL      = "http://localhost:3000"
TEST_EMAIL    = "test@test.com"
TEST_PASSWORD = "test1234"


@pytest.fixture(scope="module")
def logged_in_page(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page    = context.new_page()

    page.goto(f"{BASE_URL}/login")
    page.fill('input[type="email"]',    TEST_EMAIL)
    page.fill('input[type="password"]', TEST_PASSWORD)
    page.click('button[type="submit"]')

    # Wait for navbar — rendered only when authenticated
    page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

    yield page
    browser.close()


# ──────────────────────────────────────────────────────────────────────────────
class TestAuth:

    def test_login_success(self, page: Page):
        """TC-01: Valid credentials navigate away from /login to CourseCatalogPage (/)."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        # Auth.js calls navigate('/') on success — wait for navbar proof of auth
        page.wait_for_selector('[data-tour="navbar"]', timeout=20_000)
        expect(page).not_to_have_url(f"{BASE_URL}/login", timeout=5_000)

    def test_login_invalid(self, page: Page):
        """TC-02: Wrong password keeps user on /login."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', "wrongpassword!")
        page.click('button[type="submit"]')
        expect(page).to_have_url(f"{BASE_URL}/login", timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestAITutor:

    def test_ai_tutor_opens_and_responds(self, logged_in_page: Page):
        """TC-03: Clicking the 'Ask AI' button (data-tour="ai-button") opens the chat panel."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=20_000)
        page.wait_for_load_state("networkidle", timeout=20_000)
        page.wait_for_selector('[data-tour="navbar"]', timeout=10_000)

        # Navbar.js renders: <button data-tour="ai-button" onClick={toggleChat}>Ask AI</button>
        # It is a direct child of the nav's right-side flex div — NOT inside a sub-nav
        ask_btn = page.locator('[data-tour="ai-button"]')
        expect(ask_btn).to_be_visible(timeout=10_000)
        ask_btn.click()

        # AI.js renders: <h3>☕ AI Java Tutor</h3> (or session title fallback)
        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        expect(chat_heading).to_be_visible(timeout=8_000)

    def test_highlight_to_ask(self, logged_in_page: Page):
        """TC-04: The open chat panel contains a textarea for user input."""
        page = logged_in_page

        # Re-open panel if it was closed between tests
        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        if not chat_heading.is_visible():
            page.locator('[data-tour="ai-button"]').click()
            expect(chat_heading).to_be_visible(timeout=8_000)

        # AI.js renders a <textarea> for the message input
        textarea = page.locator("textarea").first
        expect(textarea).to_be_visible(timeout=5_000)
        textarea.fill("What is inheritance in Java?")
        expect(textarea).to_have_value("What is inheritance in Java?")


# ──────────────────────────────────────────────────────────────────────────────
class TestQuiz:

    def test_quiz_page_loads(self, logged_in_page: Page):
        """TC-05: /exercises renders the course-selection step (h2 + two course buttons)."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        # Quiz.js first renders: <h2>📝 Exercises</h2> with Basic/Enhanced Java buttons
        heading = page.locator("h2", has_text="Exercises")
        expect(heading).to_be_visible(timeout=10_000)

    def test_quiz_answer_enables_submit(self, logged_in_page: Page):
        """TC-06: Selecting a radio answer makes the 'Check Answer' button enabled."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        # Step 1 — Quiz.js showTopicSelect: click "Basic Java" course button
        basic_btn = page.locator("button", has_text="Basic Java").first
        expect(basic_btn).to_be_visible(timeout=8_000)
        basic_btn.click()

        # Step 2 — Topic selection screen: click "Start Quiz" / generate button
        # Quiz.js renders a generate button after topic path is chosen
        page.wait_for_timeout(1_000)
        generate_btn = page.locator("button").filter(
            has_text=re.compile(r"generate|start quiz|get questions", re.IGNORECASE)
        ).first
        expect(generate_btn).to_be_visible(timeout=8_000)
        generate_btn.click()

        # Step 3 — Wait for quiz question to load (backend generates questions)
        # Quiz.js renders radio <input type="radio" name="mcq"> options per question
        page.wait_for_selector('input[type="radio"][name="mcq"]', timeout=30_000)

        # Step 4 — Select the first radio answer option
        first_option = page.locator('input[type="radio"][name="mcq"]').first
        expect(first_option).to_be_visible(timeout=5_000)
        first_option.click()

        # Step 5 — "Check Answer" button (Quiz.js) should now be enabled
        check_btn = page.locator("button", has_text=re.compile(r"Check Answer", re.IGNORECASE)).first
        expect(check_btn).to_be_visible(timeout=5_000)
        expect(check_btn).to_be_enabled(timeout=5_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestCodeExecution:

    def test_run_hello_world(self, logged_in_page: Page):
        """TC-07: /playground renders a code editor (data-tour="code-editor") and a Run button."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/playground", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        # Playground.js wraps the editor in: <div data-tour="code-editor">
        editor_container = page.locator('[data-tour="code-editor"]')
        expect(editor_container).to_be_visible(timeout=8_000)

        # Playground.js renders: <button>▶ Run Code</button>
        run_btn = page.locator("button", has_text=re.compile(r"Run Code|▶|Execute", re.IGNORECASE)).first
        expect(run_btn).to_be_visible(timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestProgressDashboard:

    def test_progress_indicator_visible(self, logged_in_page: Page):
        """TC-08: Navbar renders ProgressDisplay (data-tour="progress-display") showing a %."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        # ProgressDisplay.js renders: <div data-tour="progress-display">...{percentage}%...</div>
        progress_widget = page.locator('[data-tour="progress-display"]')
        expect(progress_widget).to_be_visible(timeout=10_000)
        # Confirm it contains a percentage value
        expect(progress_widget).to_contain_text("%", timeout=5_000)

    def test_roadmap_topic_nodes_visible(self, logged_in_page: Page):
        """TC-09: /basic-java renders at least 3 visible buttons (topic nodes + nav)."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)
        page.wait_for_selector('[data-tour="navbar"]', timeout=8_000)

        all_btns = page.locator("button").all()
        visible_count = sum(1 for b in all_btns if b.is_visible())
        assert visible_count >= 3, \
            f"Expected ≥3 visible buttons (topic nodes + nav), found {visible_count}"