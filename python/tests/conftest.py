import pytest

from resultsza import ResultsZA

BASE = "https://resultsza.co.za"
API_KEY = "test-key-123"


@pytest.fixture
def client():
    return ResultsZA(api_key=API_KEY)
