from lib.config import Config, EXAMPLE_CONFIG_PATH


def test_loads_example_config():
    cfg = Config.from_yaml(EXAMPLE_CONFIG_PATH)
    assert cfg.subfield == "technical_debt"
    assert "technical debt" in cfg.keywords
    assert cfg.year_min < cfg.year_max
    assert cfg.top_n >= 1
    assert all(p == p.lower() for p in cfg.slr_title_patterns)
