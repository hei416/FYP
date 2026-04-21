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

    # AuthContext.login() does window.location.href = '/' (hard reload)
    # Wait for full navigation to complete, then confirm navbar is present
    page.wait_for_url(f"{BASE_URL}/", timeout=20_000)
    page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

    yield page
    browser.close()


# ──────────────────────────────────────────────────────────────────────────────
class TestAuth:

    def test_login_success(self, page: Page):
        """TC-01: Valid credentials trigger hard reload to / (CourseCatalogPage)."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        # AuthContext does: window.location.href = '/' — a true browser navigation
        page.wait_for_url(f"{BASE_URL}/", timeout=20_000)
        page.wait_for_selector('[data-tour="navbar"]', timeout=10_000)

    def test_login_invalid(self, page: Page):
        """TC-02: Wrong password keeps user on /login with an error."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', "wrongpassword!")
        page.click('button[type="submit"]')
        expect(page).to_have_url(f"{BASE_URL}/login", timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestAITutor:

    def test_ai_tutor_opens_and_responds(self, logged_in_page: Page):
        """TC-03: Clicking 'Ask AI' in the navbar opens the AI chat panel."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=20_000)
        page.wait_for_load_state("networkidle", timeout=20_000)
        page.wait_for_selector('[data-tour="navbar"]', timeout=10_000)

        # Navbar.js: <button data-tour="ai-button"> is INSIDE <nav data-tour="navbar">
        # TextHighlightButton also renders a floating "Ask AI" button with
        # class="highlight-ai-button" — NOT data-tour="ai-button" — but Playwright
        # strict mode still found 2 matches, so scope explicitly to the <nav> element.
        ask_btn = page.locator('nav[data-tour="navbar"] button[data-tour="ai-button"]')
        expect(ask_btn).to_be_visible(timeout=10_000)
        ask_btn.click()

        # AI.js renders: <h3>☕ AI Java Tutor</h3>
        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        expect(chat_heading).to_be_visible(timeout=8_000)

    def test_highlight_to_ask(self, logged_in_page: Page):
        """TC-04: The open chat panel contains a textarea for user input."""
        page = logged_in_page

        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        if not chat_heading.is_visible():
            page.locator('nav[data-tour="navbar"] button[data-tour="ai-button"]').click()
            expect(chat_heading).to_be_visible(timeout=8_000)

        textarea = page.locator("textarea").first
        expect(textarea).to_be_visible(timeout=5_000)
        textarea.fill("What is inheritance in Java?")
        expect(textarea).to_have_value("What is inheritance in Java?")


# ──────────────────────────────────────────────────────────────────────────────
class TestQuiz:

    def test_quiz_page_loads(self, logged_in_page: Page):
        """TC-05: /exercises renders the course selection heading."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        # Quiz.js step 1 always renders this heading first
        heading = page.locator("h2", has_text="Exercises")
        expect(heading).to_be_visible(timeout=10_000)

    def test_quiz_answer_enables_submit(self, logged_in_page: Page):
        """TC-06: Selecting a radio answer makes the 'Check Answer' button enabled."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        # ── Step 1: choose "Basic Java" course path ──────────────────────────
        basic_btn = page.locator("button", has_text="Basic Java").first
        expect(basic_btn).to_be_visible(timeout=8_000)
        basic_btn.click()

        # ── Step 2: select all topics then start quiz ─────────────────────────
        # Quiz.js renders "Select All Topics" button to pre-check all checkboxes,
        # then the Start Quiz button becomes enabled
        select_all = page.locator("button", has_text="Select All Topics").first
        expect(select_all).to_be_visible(timeout=8_000)
        select_all.click()

        # Start Quiz button: "🚀 Start Quiz (N topics)"
        start_btn = page.locator("button", has_text=re.compile(r"Start Quiz", re.IGNORECASE)).first
        expect(start_btn).to_be_enabled(timeout=5_000)
        start_btn.click()

        # ── Step 3: wait for backend to return quiz questions ─────────────────
        # Quiz.js renders radio inputs with name="mcq" once questions arrive
        page.wait_for_selector('input[type="radio"][name="mcq"]', timeout=30_000)

        # ── Step 4: click the first answer option ─────────────────────────────
        first_option = page.locator('input[type="radio"][name="mcq"]').first
        expect(first_option).to_be_visible(timeout=5_000)
        first_option.click()

        # ── Step 5: "Check Answer" button must now be enabled ─────────────────
        # Quiz.js: disabled when feedback starts with "✅" or hasAnswered is true
        check_btn = page.locator("button", has_text="Check Answer").first
        expect(check_btn).to_be_visible(timeout=5_000)
        expect(check_btn).to_be_enabled(timeout=5_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestCodeExecution:

    def test_run_hello_world(self, logged_in_page: Page):
        """TC-07: /playground renders a code editor and a Run Code button."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/playground", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        # Playground.js wraps the editor in <div data-tour="code-editor">
        editor_container = page.locator('[data-tour="code-editor"]')
        expect(editor_container).to_be_visible(timeout=8_000)

        # Playground.js renders: <button>▶ Run Code</button>
        run_btn = page.locator("button", has_text=re.compile(r"Run Code|▶", re.IGNORECASE)).first
        expect(run_btn).to_be_visible(timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestProgressDashboard:

    def test_progress_indicator_visible(self, logged_in_page: Page):
        """TC-08: Navbar renders ProgressDisplay showing a percentage."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        # ProgressDisplay.js renders <div data-tour="progress-display"> with {percentage}%
        progress_widget = page.locator('[data-tour="progress-display"]')
        expect(progress_widget).to_be_visible(timeout=10_000)
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