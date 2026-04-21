# tests/test_browser_compat.py
# Run with:
# pytest tests/test_browser_compat.py --browser chromium --browser firefox --browser webkit -v

from playwright.sync_api import Page, expect

BASE_URL      = "http://localhost:3000"
TEST_EMAIL    = "test@test.com"
TEST_PASSWORD = "test1234"


def _login(page: Page):
    """Helper: log in and wait for navbar."""
    page.goto(f"{BASE_URL}/login")
    page.fill('input[type="email"]',    TEST_EMAIL)
    page.fill('input[type="password"]', TEST_PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)


class TestBrowserCompat:

    def test_bc01_login_page_renders(self, page: Page):
        """BC-01: Login page form elements visible."""
        page.goto(f"{BASE_URL}/login")
        expect(page.locator('input[type="email"]')).to_be_visible(timeout=8_000)
        expect(page.locator('input[type="password"]')).to_be_visible(timeout=8_000)
        expect(page.locator('button[type="submit"]')).to_be_visible(timeout=8_000)

    def test_bc02_login_flow(self, page: Page):
        """BC-02: Valid credentials reach authenticated state."""
        _login(page)
        expect(page.locator('[data-tour="navbar"]')).to_be_visible(timeout=8_000)

    def test_bc03_course_page_loads(self, page: Page):
        """BC-03: /basic-java renders topic content on all browsers."""
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]',    TEST_EMAIL)
        page.fill('input[type="password"]', TEST_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_selector('[data-tour="navbar"]', timeout=15_000)

        page.goto(f"{BASE_URL}/basic-java", timeout=15_000)
        # Don't use networkidle — React internal navigations keep it busy
        # Wait for a concrete DOM element instead
        page.wait_for_selector('[data-tour="navbar"]', timeout=12_000)
        content = page.locator("h1, h2, h3, button").first
        expect(content).to_be_visible(timeout=8_000)

    def test_bc04_playground_renders_editor(self, page: Page):
        """BC-04: /playground renders a code textarea."""
        _login(page)
        page.goto(f"{BASE_URL}/playground", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=12_000)
        expect(page.locator("textarea").first).to_be_visible(timeout=8_000)

    def test_bc05_exercises_page_loads(self, page: Page):
        """BC-05: /exercises renders visible content."""
        _login(page)
        page.goto(f"{BASE_URL}/exercises", timeout=15_000)
        page.wait_for_load_state("networkidle", timeout=15_000)
        expect(page.locator("h1, h2, h3, p").first).to_be_visible(timeout=8_000)