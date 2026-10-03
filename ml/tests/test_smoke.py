import lightgbm
import onnxruntime
import onnxmltools


def test_ml_imports() -> None:
    assert lightgbm.__version__ == "4.7.0"
    assert onnxmltools.__version__ == "1.16.0"
    assert onnxruntime.__version__ == "1.30.0"
