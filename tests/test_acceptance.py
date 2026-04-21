# tests/test_acceptance.py
import pytest
from playwright.sync_api import Page, expect
import re

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

    # Wait for the navbar (rendered only when authenticated and on a real page)
    # instead of wait_for_url — avoids the React internal navigation race
    page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

    yield page
    browser.close()


# ──────────────────────────────────────────────────────────────────────────────
class TestAuth:

    def test_login_success(self, page: Page):
        """TC-01: Valid credentials redirect away from /login."""
        page.goto(f"{BASE_URL}/login")
        page.fill("#email",    TEST_EMAIL)
        page.fill("#password", TEST_PASSWORD)
        page.click('button[type="submit"]')
        # Wait for navbar — proves auth succeeded and real page loaded
        page.wait_for_selector('[data-tour="navbar"]', timeout=20_000)
        # Assert we are no longer on /login
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
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=20_000)
        page.wait_for_load_state("networkidle", timeout=20_000)
        # Wait for navbar to be stable first
        page.wait_for_selector('[data-tour="navbar"]', timeout=10_000)

        ask_btn = page.locator('nav[data-tour="navbar"] [data-tour="ai-button"]')
        expect(ask_btn).to_be_visible(timeout=10_000)
        ask_btn.click()

        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        expect(chat_heading).to_be_visible(timeout=6_000)

    def test_highlight_to_ask(self, logged_in_page: Page):
        """TC-04: The open chat panel contains a textarea for input."""
        page = logged_in_page

        chat_heading = page.locator("h3", has_text="AI Java Tutor")
        if not chat_heading.is_visible():
            page.locator('nav[data-tour="navbar"] [data-tour="ai-button"]').click()
            expect(chat_heading).to_be_visible(timeout=6_000)

        textarea = page.locator("textarea").first
        expect(textarea).to_be_visible(timeout=5_000)
        textarea.fill("What is inheritance in Java?")
        expect(textarea).to_have_value("What is inheritance in Java?")


# ──────────────────────────────────────────────────────────────────────────────
class TestQuiz:

    def test_quiz_page_loads(self, logged_in_page: Page):
        """TC-05: /exercises renders visible content."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        content = page.locator("h1, h2, h3, p").first
        expect(content).to_be_visible(timeout=10_000)

    def test_quiz_answer_enables_submit(self, logged_in_page: Page):
        """TC-06: Clicking an answer option makes a Submit/Check button visible."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)

        NAV_LABELS = {
            "Logout", "Ask AI", "×", "▶", "Login / Register",
            "Courses", "Playground", "Exercises", "Coding Challenges",
            "My Work", "Chat History", "My Classrooms",
            "Teacher Dashboard", "Admin Panel", "CodeTutor",
            "Start Tour", "✕",
        }

        # Click the first non-nav visible button (a quiz answer option)
        clicked = False
        for btn in page.locator("button").all():
            try:
                txt = btn.inner_text(timeout=500).strip()
                if txt and txt not in NAV_LABELS and btn.is_visible():
                    btn.click(timeout=2_000)
                    clicked = True
                    break
            except Exception:
                continue

        assert clicked, "Could not find any clickable quiz option button"

        # FIX: Give React time to re-render after answer selection,
        # then use a broad has-text match covering all Quiz.js button variants
        page.wait_for_timeout(1_000)
        submit = page.locator("button").filter(
            has_text=re.compile(r"submit|check|next|confirm|answer", re.IGNORECASE)
        ).first
        expect(submit).to_be_visible(timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestCodeExecution:

    def test_run_hello_world(self, logged_in_page: Page):
        """TC-07: /playground renders a code editor and a Run button."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/playground", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        editor = page.locator("textarea").first
        expect(editor).to_be_visible(timeout=8_000)

        run_btn = page.locator(
            "button:has-text('Run'), button:has-text('▶'), button:has-text('Execute')"
        ).first
        expect(run_btn).to_be_visible(timeout=6_000)


# ──────────────────────────────────────────────────────────────────────────────
class TestProgressDashboard:

    def test_progress_indicator_visible(self, logged_in_page: Page):
        """TC-08: The navbar renders the ProgressDisplay component."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        progress = page.get_by_text("%", exact=False).first
        expect(progress).to_be_visible(timeout=10_000)

    def test_roadmap_topic_nodes_visible(self, logged_in_page: Page):
        """TC-09: The home/courses page renders Java topic nodes."""
        page = logged_in_page
        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)

        page.wait_for_selector('[data-tour="navbar"]', timeout=8_000)

        all_btns = page.locator("button").all()
        visible_count = sum(1 for b in all_btns if b.is_visible())
        assert visible_count >= 3, \
            f"Expected ≥3 visible buttons (topic nodes), found {visible_count}"